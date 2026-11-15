//! Bounded route receipts: last 32 plans for Stats, 2048 authored route sets for deletes.
use super::*;
use crate::engine::{protocol::Delivery, publication_plan::Destination};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
pub(super) struct Record {
    id: String,
    kind: u64,
    at: u64,
    deliveries: Vec<Destination>,
    #[serde(rename = "unresolvedRecipients")]
    unresolved_recipients: usize,
}
impl Network {
    pub fn published_routes(&self, id: &str) -> Vec<String> {
        self.publication_routes.get(id).cloned().unwrap_or_default()
    }
    pub(super) fn remember_publication(
        &mut self,
        event: &NostrEvent,
        deliveries: Vec<Destination>,
        now: u64,
    ) {
        if self.publication_history.len() >= 32 {
            self.publication_history.pop_front();
        }
        // Keep attempted destinations too: a missing ACK does not prove absence.
        let routes = deliveries
            .iter()
            .filter(|d| d.state != "skipped")
            .map(|d| d.url.clone())
            .collect();
        self.retain_routes(event.id.clone(), routes);
        self.publication_revision = self.publication_revision.wrapping_add(1);
        self.publication_history.push_back(Record {
            id: event.id.clone(),
            kind: event.kind,
            at: now,
            deliveries,
            unresolved_recipients: crate::engine::publication_discovery::recipients(event).len(),
        });
    }
    pub(super) fn update_publication(&mut self, id: &str, deliveries: &[Delivery]) {
        if let Some(record) = self.publication_history.iter_mut().find(|r| r.id == id) {
            for d in &mut record.deliveries {
                if let Some(next) = deliveries.iter().find(|next| next.relay == d.url) {
                    d.state.clone_from(&next.state);
                }
            }
        }
    }
    pub(in crate::engine) fn extend_publication_history(
        &mut self,
        id: &str,
        routes: Vec<Destination>,
    ) {
        let mut retained = self.published_routes(id);
        for route in &routes {
            if route.state != "skipped" && !retained.contains(&route.url) && retained.len() < 64 {
                retained.push(route.url.clone());
            }
        }
        if retained != self.published_routes(id) {
            self.retain_routes(id.to_owned(), retained);
            self.publication_revision = self.publication_revision.wrapping_add(1);
        }
        if let Some(record) = self.publication_history.iter_mut().find(|r| r.id == id) {
            for route in routes {
                if let Some(old) = record.deliveries.iter_mut().find(|d| d.url == route.url) {
                    if old.state == "skipped" && route.state != "skipped" {
                        *old = route;
                    }
                } else if record.deliveries.len() < 2240 {
                    record.deliveries.push(route);
                }
            }
        }
    }
    pub(in crate::engine) fn set_unresolved_recipients(&mut self, id: &str, count: usize) {
        if let Some(record) = self.publication_history.iter_mut().find(|r| r.id == id) {
            record.unresolved_recipients = count.min(32);
        }
    }
    pub fn recent_publications(&self) -> Value {
        json!(self.publication_history)
    }
    pub fn publication_relays(&self) -> BTreeSet<String> {
        self.publication_history
            .iter()
            .flat_map(|r| r.deliveries.iter().map(|d| d.url.clone()))
            .collect()
    }
    pub fn publication_stats(&self, url: &str) -> Value {
        let ds: Vec<_> = self
            .publication_history
            .iter()
            .flat_map(|r| &r.deliveries)
            .filter(|d| d.url == url)
            .collect();
        let state = |s: &str| ds.iter().filter(|d| d.state == s).count();
        let reason = |s: &str| ds.iter().filter(|d| d.reason.as_deref() == Some(s)).count();
        json!({"publishPlanned":ds.len()-state("skipped"),"publishAccepted":state("accepted"),"publishFailed":state("rejected")+state("timeout"),"publishPending":state("pending"),"publishSkipped":state("skipped"),"publishOwnSkipped":reason("own-cap"),"publishInboxSkipped":reason("inbox-cap")+reason("person-cap"),"publishCapacitySkipped":reason("capacity")})
    }
    fn retain_routes(&mut self, id: String, routes: Vec<String>) {
        self.publication_route_order.retain(|old| old != &id);
        self.publication_route_order.push_back(id.clone());
        self.publication_route_bytes += routes.iter().map(String::len).sum::<usize>();
        if let Some(old) = self.publication_routes.insert(id, routes) {
            self.publication_route_bytes -= old.iter().map(String::len).sum::<usize>();
        }
        while self.publication_route_order.len() > 2048
            || self.publication_route_bytes > 4 * 1024 * 1024
        {
            if let Some(old) = self.publication_route_order.pop_front()
                && let Some(routes) = self.publication_routes.remove(&old)
            {
                self.publication_route_bytes -= routes.iter().map(String::len).sum::<usize>();
            }
        }
    }
    pub fn publication_routes_json(&self) -> String {
        let ordered: Vec<_> = self
            .publication_route_order
            .iter()
            .filter_map(|id| self.publication_routes.get(id).map(|routes| (id, routes)))
            .collect();
        serde_json::to_string(&ordered).unwrap_or_default()
    }
    pub fn restore_publication_routes(&mut self, raw: &str) {
        // No migration: malformed state starts clean. The blob and FIFO are bounded.
        self.publication_routes.clear();
        self.publication_route_order.clear();
        self.publication_route_bytes = 0;
        if raw.len() > 8 * 1024 * 1024 {
            return;
        }
        let Ok(routes) = serde_json::from_str::<Vec<(String, Vec<String>)>>(raw) else {
            return;
        };
        for (id, rs) in routes.into_iter().rev().take(2048).rev() {
            if !lkjstr_protocol::is_event_id(&id) {
                continue;
            }
            let routes = rs
                .into_iter()
                .filter_map(|r| crate::engine::settings::strict_relay(&r))
                .take(64)
                .collect();
            self.retain_routes(id, routes);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn discovered_routes_preserve_receipts_and_extend_durable_delete_destinations() {
        let mut network = Network::default();
        let destination = |url: &str, state: &str| Destination {
            url: url.into(),
            rule: "inbox".into(),
            state: state.into(),
            reason: (state == "skipped").then(|| "inbox-cap".into()),
        };
        let id = "a".repeat(64);
        network.publication_history.push_back(Record {
            id: id.clone(),
            kind: 1,
            at: 0,
            unresolved_recipients: 0,
            deliveries: vec![
                destination("wss://accepted.test/", "accepted"),
                destination("wss://skipped.test/", "skipped"),
            ],
        });
        network.retain_routes(id.clone(), vec!["wss://accepted.test/".into()]);
        network.extend_publication_history(
            &id,
            vec![
                destination("wss://accepted.test/", "pending"),
                destination("wss://skipped.test/", "pending"),
                destination("wss://new.test/", "pending"),
            ],
        );
        let rows = network.recent_publications();
        assert_eq!(rows[0]["deliveries"][0]["state"], "accepted");
        assert_eq!(rows[0]["deliveries"][1]["state"], "pending");
        assert_eq!(rows[0]["deliveries"][2]["state"], "pending");
        assert_eq!(network.published_routes(&id).len(), 3);
        let mut restored = Network::default();
        restored.restore_publication_routes(&network.publication_routes_json());
        assert_eq!(
            restored.published_routes(&id),
            network.published_routes(&id)
        );
        assert_eq!(network.publication_revision, 1);
    }
}
