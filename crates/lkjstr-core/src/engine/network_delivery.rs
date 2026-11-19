//! Sent-route receipts survive the send deadline. No event bodies are retained.
use super::*;
use crate::engine::protocol::Delivery;
pub(super) struct Receipt {
    pub req: String,
    pub deliveries: Vec<Delivery>,
    pub finished_at: u64,
    pub checked: BTreeSet<String>,
    // At most one five-second finite check per sent relay (<= 20 routes).
    pub checks: BTreeMap<String, (String, u64)>,
}
impl Publication {
    pub(in crate::engine) fn delivery(&self) -> Vec<Delivery> {
        self.deliveries
            .iter()
            .filter(|(url, _)| self.attempted.contains(*url))
            .map(|(relay, state)| Delivery {
                relay: relay.clone(),
                state: state.clone(),
                message: self.messages.get(relay).cloned(),
            })
            .collect()
    }

    fn connection_error(&self) -> &'static str {
        if self.event.kind == 1 && self.deliveries.values().any(|state| state != "skipped") {
            "relay-unreachable"
        } else {
            "no-relays"
        }
    }
}
impl Network {
    /// The effect host reports an unsuccessful socket send; a failed retry cannot
    /// erase an earlier successful send. Native effect fixtures assume delivery.
    pub fn publication_frame_sent(
        &mut self,
        relay: &str,
        text: &str,
        sent: bool,
    ) -> Option<NostrEvent> {
        self.publication_frame_sent_at(relay, text, sent, self.now)
    }

    pub(in crate::engine) fn publication_frame_sent_at(
        &mut self,
        relay: &str,
        text: &str,
        sent: bool,
        now: u64,
    ) -> Option<NostrEvent> {
        let frame = serde_json::from_str::<Value>(text).ok()?;
        if frame[0] != "EVENT" {
            return None;
        }
        let p = frame[1]["id"]
            .as_str()
            .and_then(|id| self.publications.get_mut(id))?;
        if sent {
            let first = p.transport_confirmed.is_empty();
            if p.transport_confirmed.insert(relay.into())
                && let Some((_, ack)) = p.note_route_deadlines.get_mut(relay)
            {
                *ack = Some(now.saturating_add(NOTE_ACK_WAIT_MS));
            }
            if !p.default_notice_sent && p.default_routes.iter().any(|url| url == relay) {
                p.default_notice_sent = true;
                self.output
                    .push(Output::PublishFallback { req: p.req.clone() });
            }
            if first && p.event.kind == 1 {
                self.profiles_changed = true;
                return Some(p.event.clone());
            }
        } else {
            if !p.transport_confirmed.contains(relay) && p.attempted.remove(relay) {
                p.observed.remove(relay);
                if let Some((_, ack)) = p.note_route_deadlines.get_mut(relay) {
                    *ack = None;
                }
                self.output.push(Output::Delivery {
                    req: p.req.clone(),
                    deliveries: p.delivery(),
                });
            }
        }
        None
    }

    pub fn watch_deliveries(&mut self, reqs: Vec<String>) {
        self.delivery_watches = reqs.into_iter().take(4096).collect();
        self.prune_receipts();
    }
    pub(super) fn prune_receipts(&mut self) {
        let remove: Vec<_> = self
            .receipts
            .iter()
            .filter(|(id, r)| {
                !self.delivery_watches.contains(&r.req) && !self.retained_delivery(id)
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in remove {
            if let Some(r) = self.receipts.remove(&id) {
                for (url, (wire, _)) in r.checks {
                    self.send(&url, json!(["CLOSE", wire]));
                }
            }
        }
    }
    pub(super) fn finish_delivery(&mut self, id: String, mut p: Publication, now: u64) {
        for (url, state) in p
            .deliveries
            .iter_mut()
            .filter(|(url, s)| *s == "pending" || (*s == "timeout" && p.observed.contains(*url)))
        {
            *state = if p.observed.contains(url) {
                "accepted"
            } else {
                "timeout"
            }
            .into();
        }
        let all = p
            .deliveries
            .iter()
            .map(|(relay, state)| Delivery {
                relay: relay.clone(),
                state: state.clone(),
                message: p.messages.get(relay).cloned(),
            })
            .collect::<Vec<_>>();
        self.update_publication(&id, &all);
        let deliveries = p.delivery();
        self.output.push(Output::Delivery {
            req: p.req.clone(),
            deliveries: deliveries.clone(),
        });
        if !p.reported_success {
            self.output.push(Output::Result {
                req: p.req.clone(),
                id: Some(id.clone()),
                error: deliveries.is_empty().then(|| p.connection_error().into()),
                deliveries: deliveries.clone(),
            });
        }
        self.receipts.insert(
            id,
            Receipt {
                req: p.req,
                deliveries,
                finished_at: now,
                checked: BTreeSet::new(),
                checks: BTreeMap::new(),
            },
        );
        self.prune_receipts();
    }
    pub(super) fn answer_delivery(
        &mut self,
        id: &str,
        relay: &str,
        accepted: bool,
        message: &str,
        now: u64,
    ) {
        let retry = !accepted && quality::limited(message);
        let update = if let Some(p) = self.publications.get_mut(id) {
            if !p.attempted.contains(relay)
                || !p
                    .deliveries
                    .get(relay)
                    .is_some_and(|s| s == "pending" || (!retry && s == "timeout"))
            {
                return;
            }
            if !retry {
                p.deliveries.insert(
                    relay.into(),
                    if accepted { "accepted" } else { "rejected" }.into(),
                );
                if !message.is_empty() {
                    p.messages
                        .insert(relay.into(), message.chars().take(512).collect());
                }
            }
            let deliveries = p.delivery();
            if accepted && !p.reported_success {
                p.reported_success = true;
                self.output.push(Output::Result {
                    req: p.req.clone(),
                    id: Some(id.into()),
                    deliveries: deliveries.clone(),
                    error: None,
                });
            }
            Some((p.req.clone(), deliveries))
        } else if let Some(r) = self.receipts.get_mut(id) {
            let Some(d) = r
                .deliveries
                .iter_mut()
                .find(|d| d.relay == relay && d.state == "timeout")
            else {
                return;
            };
            d.state = if accepted { "accepted" } else { "rejected" }.into();
            d.message = (!message.is_empty()).then(|| message.chars().take(512).collect());
            Some((r.req.clone(), r.deliveries.clone()))
        } else {
            None
        };
        if let Some((req, deliveries)) = update {
            self.update_publication(id, &deliveries);
            self.output.push(Output::Delivery { req, deliveries });
            let check = self
                .receipts
                .get_mut(id)
                .and_then(|r| r.checks.remove(relay));
            if let Some((wire, _)) = check {
                self.send(relay, json!(["CLOSE", wire]));
            }
            self.profiles_changed = true;
            self.quality_revision = self.quality_revision.wrapping_add(1);
            if retry && self.publications.contains_key(id) {
                self.cool_down(relay, now);
            }
        }
    }
    pub(super) fn confirm_delivery(&mut self, relay: &str, id: &str, now: u64) {
        if let Some(p) = self.publications.get_mut(id) {
            if p.attempted.contains(relay) {
                p.observed.insert(relay.into());
            }
            return;
        }
        self.answer_delivery(id, relay, true, "", now);
        let wire = self
            .receipts
            .get_mut(id)
            .and_then(|r| r.checks.remove(relay));
        if let Some((wire, _)) = wire {
            self.send(relay, json!(["CLOSE", wire]));
        }
    }
}
