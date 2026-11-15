use super::*;
use crate::engine::protocol::Delivery;
impl Network {
    /// Frame parsing and signature verification remain in protocol/core.
    pub fn message(&mut self, relay: &str, text: &str, now: u64) -> Option<NostrEvent> {
        if text.len() > 1024 * 1024 {
            return None;
        }
        let msg = lkjstr_protocol::parse_relay_message(text, None).ok()?;
        if let Some(r) = self.relays.get_mut(relay) {
            r.last_rx = now;
            r.received += 1;
        }
        match msg {
            lkjstr_protocol::RelayMessage::Event {
                subscription_id,
                event,
            } => {
                if let Some(r) = self.requests.get_mut(&subscription_id).filter(|r| {
                    r.relay == relay && r.sent && lkjstr_protocol::matches_filter(&event, &r.filter)
                }) {
                    r.oldest = Some(
                        r.oldest
                            .map_or(event.created_at, |at| at.min(event.created_at)),
                    );
                    if r.received.len() < r.page_limit {
                        r.received.insert(event.id.clone());
                    }
                    return Some(event);
                }
            }
            lkjstr_protocol::RelayMessage::Eose(subscription_id) => {
                if let Some(r) = self
                    .requests
                    .get_mut(&subscription_id)
                    .filter(|r| r.relay == relay)
                {
                    self.profiles_changed = true;
                    r.eose = true;
                    r.last_rx = now;
                    if let Some(relay) = self.relays.get_mut(relay) {
                        let latency = now.saturating_sub(r.sent_at);
                        relay.latency_ms = Some(
                            relay
                                .latency_ms
                                .map_or(latency, |old| (old * 7 + latency) / 8),
                        );
                    }
                    if !r.live {
                        r.complete = true;
                        r.sent = false;
                        let relay = r.relay.clone();
                        self.send(&relay, json!(["CLOSE", subscription_id]));
                    }
                }
            }
            lkjstr_protocol::RelayMessage::Closed {
                subscription_id,
                message,
            } => {
                if let Some(r) = self
                    .requests
                    .get_mut(&subscription_id)
                    .filter(|r| r.relay == relay)
                {
                    self.profiles_changed = true;
                    r.deadline = now;
                    r.complete = !message.starts_with("rate-limited:");
                    r.sent = false;
                    r.ready_at = if r.complete { now } else { now + 30000 };
                    if message.starts_with("rate-limited:")
                        && let Some(relay) = self.relays.get_mut(relay)
                    {
                        relay.next_req_at = now + 30000;
                    }
                    r.eose = false;
                }
            }
            lkjstr_protocol::RelayMessage::Ok {
                event_id, accepted, ..
            } => {
                if let Some(p) = self.publications.get_mut(&event_id)
                    && p.deliveries.contains_key(relay)
                {
                    p.deliveries.insert(
                        relay.into(),
                        if accepted { "accepted" } else { "rejected" }.into(),
                    );
                    self.output.push(Output::Delivery {
                        req: p.req.clone(),
                        deliveries: p
                            .deliveries
                            .iter()
                            .map(|(relay, state)| Delivery {
                                relay: relay.clone(),
                                state: state.clone(),
                                message: None,
                            })
                            .collect(),
                    });
                }
            }
            _ => {}
        }
        None
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
                .all(|r| r.eose || r.complete || (r.sent && now >= r.deadline));
            if done {
                let state = if rs.iter().any(|r| r.last_event.is_some()) {
                    "data"
                } else if rs.iter().any(|r| !r.eose) {
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
