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
                }
                if let Some(r) = self.requests.get_mut(&subscription_id).filter(|r| {
                    r.relay == relay && r.sent && lkjstr_protocol::matches_filter(&event, &r.filter)
                }) {
                    if !r.page_eose {
                        r.oldest = Some(
                            r.oldest
                                .map_or(event.created_at, |at| at.min(event.created_at)),
                        );
                        if r.received.len() < r.page_limit {
                            r.received.insert(event.id.clone());
                        }
                    }
                    return Some(event);
                }
            }
            lkjstr_protocol::RelayMessage::Eose(subscription_id) => {
                if let Some(r) = self
                    .requests
                    .get_mut(&subscription_id)
                    .filter(|r| r.relay == relay && r.sent)
                {
                    self.profiles_changed = true;
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
                    if let Some(relay) = self.relays.get_mut(relay) {
                        relay.last_error = Some(message.chars().take(512).collect());
                    }
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
}
