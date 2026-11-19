//! Missing inbox lists are read while own delivery proceeds; all work shares its deadline.
use super::{
    Engine,
    network::{Effect, NOTE_ROUTE_WAIT_MS, Network, Relay},
    protocol::{Query, Source},
    publication_plan::Destination,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
pub(super) fn recipients(event: &NostrEvent) -> Vec<String> {
    if !matches!(event.kind, 1 | 6 | 7 | 16 | 42 | 30023) {
        return vec![];
    }
    event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|k| k == "p"))
        .filter_map(|t| t.get(1))
        .filter(|p| *p != &event.pubkey && lkjstr_protocol::is_pubkey(p))
        .cloned()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .take(32)
        .collect()
}
impl Engine {
    pub(super) fn publication_wants(&mut self, now: u64) -> Vec<(String, NostrFilter, Query)> {
        let jobs: Vec<_> = self
            .network
            .publications
            .iter()
            .filter(|(_, p)| p.discovery_pending && now < p.deadline)
            .map(|(id, p)| (id.clone(), p.event.clone(), p.recipients.clone()))
            .collect();
        let mut wants = vec![];
        for (id, event, people) in jobs {
            let missing: Vec<_> = people
                .into_iter()
                .filter(|p| {
                    self.store.replaceable(p, 10002).is_none()
                        && !self.network.list_loaded(&self.store, p, 10002)
                })
                .collect();
            self.network.set_unresolved_recipients(&id, missing.len());
            let routes = self.publication_routes(&event);
            self.network.extend_publication(&id, routes, now);
            if let Some(p) = self.network.publications.get_mut(&id) {
                p.discovery_pending = !missing.is_empty();
                p.recipients = missing.clone();
            }
            for person in missing {
                let filter = NostrFilter {
                    authors: Some(vec![person]),
                    kinds: Some(vec![10002]),
                    limit: Some(1),
                    ..Default::default()
                };
                let mut routes = self.network.read_routes(
                    &filter,
                    &Query::default(),
                    &self.store,
                    &mut super::weights::PlanWeights::new(&self.store, &self.private_lists),
                    now,
                );
                if routes.is_empty() {
                    routes = self
                        .network
                        .relay_order
                        .iter()
                        .filter(|url| {
                            self.discovery_relays.contains(url)
                                || self
                                    .network
                                    .known
                                    .get(*url)
                                    .is_some_and(|r| r.write || r.search)
                        })
                        .take(2)
                        .cloned()
                        .collect();
                }
                for relay in routes {
                    wants.push((
                        format!("~publication:{id}"),
                        filter.clone(),
                        Query {
                            source: Source::Relay,
                            target: Some(relay),
                            ..Default::default()
                        },
                    ));
                }
            }
        }
        wants
    }
}
impl Network {
    fn extend_publication(&mut self, id: &str, mut routes: Vec<Destination>, now: u64) {
        let Some(p) = self.publications.get(id) else {
            return;
        };
        routes.retain(|d| !p.deliveries.contains_key(&d.url));
        // Freeze already planned own destinations. Discovery can add only inbox/context.
        routes.retain(|d| d.rule != "own");
        let mut extra = p.inbox_routes.len();
        for d in routes.iter_mut().filter(|d| d.state == "pending") {
            if extra >= 8 {
                d.state = "skipped".into();
                d.reason = Some("inbox-cap".into());
                continue;
            }
            extra += 1;
            if !self.relays.contains_key(&d.url) {
                if self.relays.len() >= 64 {
                    d.state = "skipped".into();
                    d.reason = Some("capacity".into());
                    continue;
                }
                self.effects.push(Effect::Inspect(d.url.clone()));
                self.relays.insert(
                    d.url.clone(),
                    Relay {
                        retry_at: now,
                        max_reqs: 4,
                        max_limit: 200,
                        ..Default::default()
                    },
                );
            }
            if let Some(p) = self.publications.get_mut(id) {
                p.deliveries.insert(d.url.clone(), "pending".into());
                p.inbox_routes.insert(d.url.clone());
                if p.event.kind == 1 {
                    p.note_route_deadlines
                        .insert(d.url.clone(), now.saturating_add(NOTE_ROUTE_WAIT_MS));
                }
            }
        }
        let added = routes.iter().any(|d| d.state == "pending");
        self.extend_publication_history(id, routes);
        if added && let Some(p) = self.publications.get(id) {
            self.output.push(super::protocol::Output::Delivery {
                req: p.req.clone(),
                deliveries: p.delivery(),
            });
        }
    }
}
