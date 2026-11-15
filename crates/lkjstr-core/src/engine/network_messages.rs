use super::*;
use crate::engine::protocol::Delivery;
impl Network {
    /// Frame parsing and signature verification remain in protocol/core.
    pub fn message(&mut self, relay: &str, text: &str, now: u64) -> Option<NostrEvent> {
        if text.len() > 1024 * 1024 {
            return None;
        }
        if let Some(r) = self.relays.get_mut(relay) {
            r.bytes_in += text.len() as u64;
        }
        let msg = lkjstr_protocol::parse_relay_message(text, None).ok()?;
        if let Some(r) = self.relays.get_mut(relay) {
            r.last_rx = now;
        }
        match msg {
            lkjstr_protocol::RelayMessage::Event {
                subscription_id,
                event,
            } => {
                if let Some(r) = self.relays.get_mut(relay) {
                    r.received += 1;
                    self.quality_revision = self.quality_revision.wrapping_add(1);
                }
                let mut accepted = false;
                for r in self.requests.values_mut().filter(|r| {
                    r.wire_id == subscription_id
                        && r.relay == relay
                        && r.sent
                        && lkjstr_protocol::matches_filter(&event, &r.filter)
                }) {
                    accepted = true;
                    if !r.page_eose {
                        r.oldest = Some(
                            r.oldest
                                .map_or(event.created_at, |at| at.min(event.created_at)),
                        );
                        if r.received.len() < r.page_limit {
                            r.received.insert(event.id.clone());
                        }
                    }
                }
                if accepted {
                    return Some(event);
                }
            }
            lkjstr_protocol::RelayMessage::Eose(subscription_id) => {
                let mut close = false;
                for r in self
                    .requests
                    .values_mut()
                    .filter(|r| r.wire_id == subscription_id && r.relay == relay && r.sent)
                {
                    self.profiles_changed = true;
                    self.quality_revision = self.quality_revision.wrapping_add(1);
                    r.eose = true;
                    r.page_eose = true;
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
                        close = true;
                    }
                }
                if close {
                    self.send(relay, json!(["CLOSE", subscription_id]));
                }
            }
            lkjstr_protocol::RelayMessage::Closed {
                subscription_id,
                message,
            } => {
                let split = !quality::limited(&message)
                    && self
                        .requests
                        .values()
                        .filter(|r| r.relay == relay && r.wire_id == subscription_id && r.sent)
                        .count()
                        > 1;
                if split && let Some(r) = self.relays.get_mut(relay) {
                    r.max_filters = 1;
                    r.single_filters = true;
                }
                for r in self
                    .requests
                    .values_mut()
                    .filter(|r| r.wire_id == subscription_id && r.relay == relay)
                {
                    self.profiles_changed = true;
                    self.quality_revision = self.quality_revision.wrapping_add(1);
                    if let Some(relay) = self.relays.get_mut(relay) {
                        relay.last_error = Some(message.chars().take(512).collect());
                    }
                    r.deadline = now;
                    r.complete = !split && !quality::limited(&message);
                    r.sent = false;
                    r.ready_at = if r.complete || split {
                        now
                    } else {
                        now + 30000
                    };
                    r.eose = false;
                }
                if quality::limited(&message) {
                    self.cool_down(relay, now);
                }
            }
            lkjstr_protocol::RelayMessage::Ok {
                event_id,
                accepted,
                message,
            } => {
                if let Some(p) = self.publications.get_mut(&event_id)
                    && p.deliveries.get(relay).is_some_and(|s| s == "pending")
                    && p.sent.contains_key(relay)
                    && now < p.deadline
                {
                    let retry = !accepted && quality::limited(&message);
                    if !retry {
                        p.deliveries.insert(
                            relay.into(),
                            if accepted { "accepted" } else { "rejected" }.into(),
                        );
                    }
                    let deliveries = p
                        .deliveries
                        .iter()
                        .map(|(relay, state)| Delivery {
                            relay: relay.clone(),
                            state: state.clone(),
                            message: None,
                        })
                        .collect::<Vec<_>>();
                    self.output.push(Output::Delivery {
                        req: p.req.clone(),
                        deliveries: deliveries.clone(),
                    });
                    if accepted && !p.reported_success {
                        p.reported_success = true;
                        self.output.push(Output::Result {
                            req: p.req.clone(),
                            id: Some(event_id.clone()),
                            deliveries: deliveries.clone(),
                            error: None,
                        });
                    }
                    self.profiles_changed = true;
                    self.quality_revision = self.quality_revision.wrapping_add(1);
                    self.update_publication(&event_id, &deliveries);
                    if retry {
                        self.cool_down(relay, now);
                    }
                }
            }
            lkjstr_protocol::RelayMessage::Notice(message) if quality::limited(&message) => {
                self.cool_down(relay, now);
            }
            _ => {}
        }
        None
    }
}
