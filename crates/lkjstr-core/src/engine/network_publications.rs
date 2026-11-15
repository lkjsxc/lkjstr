use super::*;
use crate::engine::protocol::Delivery;
impl Network {
    pub fn pending_event(&self, id: &str) -> bool {
        self.publications.contains_key(id)
    }
    pub fn publish(&mut self, req: String, event: NostrEvent, now: u64) {
        if self.publications.len() >= 64 || self.publications.contains_key(&event.id) {
            self.output.push(Output::Error {
                req: Some(req),
                code: "publication-limit".into(),
            });
            return;
        }
        let deliveries = self
            .relays
            .keys()
            .filter(|u| self.known.get(*u).is_none_or(|r| r.write))
            .take(3)
            .map(|r| (r.clone(), "pending".into()))
            .collect();
        self.publications.insert(
            event.id.clone(),
            Publication {
                req,
                event,
                deadline: now + 10000,
                deliveries,
                sent: BTreeSet::new(),
            },
        );

        self.send_pending();
        self.tick(now);
    }
    pub(super) fn send_pending(&mut self) {
        let mut frames = Vec::new();
        for p in self.publications.values_mut() {
            for (relay, state) in &p.deliveries {
                if state == "pending"
                    && !p.sent.contains(relay)
                    && self.relays.get(relay).is_some_and(|r| r.online)
                {
                    p.sent.insert(relay.clone());
                    frames.push((relay.clone(), p.event.clone()));
                }
            }
        }
        for (relay, event) in frames {
            self.send(&relay, json!(["EVENT", event]));
        }
    }
    pub(super) fn settle(&mut self, now: u64) {
        let subs: BTreeSet<_> = self
            .requests
            .values()
            .flat_map(|r| r.members.iter().cloned())
            .collect();
        for sub in subs {
            if self.verifying {
                break;
            }
            let rs: Vec<_> = self
                .requests
                .values()
                .filter(|r| r.members.contains(&sub))
                .collect();
            let done = rs
                .iter()
                .all(|r| r.page_eose || r.eose || r.complete || (r.sent && now >= r.deadline));
            if done {
                let state = if rs.iter().any(|r| r.last_event.is_some()) {
                    "data"
                } else if rs.iter().any(|r| !r.eose && !r.page_eose) {
                    "error"
                } else {
                    "not-found"
                };
                if self.reported.get(&sub).is_none_or(|s| s != state) {
                    self.output.push(Output::Status {
                        sub: sub.clone(),
                        state: state.into(),
                        answered_relays: self.request_progress(&sub).1,
                        asked_relays: rs
                            .iter()
                            .filter(|r| r.asked)
                            .map(|r| &r.relay)
                            .collect::<BTreeSet<_>>()
                            .len(),
                    });
                    self.reported.insert(sub.clone(), state.into());
                }
            }
        }
        let timed_out: Vec<_> = self
            .requests
            .iter()
            .filter(|(_, r)| !r.eose && !r.complete && r.sent && now >= r.deadline)
            .map(|(id, _)| id.clone())
            .collect();
        for id in timed_out {
            if let Some(r) = self.requests.get_mut(&id) {
                self.profiles_changed = true;
                r.complete = !r.live;
                r.ready_at = now + r.retry_delay;
                r.retry_delay = (r.retry_delay * 2).min(30000);
                let was_sent = r.sent;
                r.sent = false;
                let relay = r.relay.clone();
                if was_sent {
                    self.send(&relay, json!(["CLOSE", id]));
                }
            }
        }
        let ids: Vec<_> = self
            .publications
            .iter()
            .filter(|(_, p)| now >= p.deadline || p.deliveries.values().all(|s| s != "pending"))
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            if let Some(p) = self.publications.remove(&id) {
                self.output.push(Output::Result {
                    req: p.req,
                    id: Some(id),
                    deliveries: p
                        .deliveries
                        .into_iter()
                        .map(|(relay, state)| Delivery {
                            relay,
                            state: if state == "pending" {
                                "timeout".into()
                            } else {
                                state
                            },
                            message: None,
                        })
                        .collect(),
                    error: None,
                });
            }
        }
    }
}
