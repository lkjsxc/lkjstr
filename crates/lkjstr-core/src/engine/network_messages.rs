use super::*;
impl Network {
    /// Frame parsing and signature verification remain in protocol/core.
    pub fn message(&mut self, relay: &str, text: &str, now: u64) -> Option<NostrEvent> {
        self.message_with_transport(relay, text, now, false, |_| {})
    }
    pub fn message_observed(
        &mut self,
        relay: &str,
        text: &str,
        now: u64,
        on_acceptance: impl FnOnce(&str),
    ) -> Option<NostrEvent> {
        self.message_with_transport(relay, text, now, true, on_acceptance)
    }

    fn message_with_transport(
        &mut self,
        relay: &str,
        text: &str,
        now: u64,
        require_transport: bool,
        on_acceptance: impl FnOnce(&str),
    ) -> Option<NostrEvent> {
        self.now = now;
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
            lkjstr_protocol::RelayMessage::Auth(challenge) => self.auth_challenge(relay, challenge),
            lkjstr_protocol::RelayMessage::Event {
                subscription_id,
                event,
            } => {
                if let Some(r) = self.relays.get_mut(relay) {
                    r.received += 1;
                    self.quality_revision = self.quality_revision.wrapping_add(1);
                }
                if self.delivery_event(relay, &subscription_id, &event) {
                    return Some(event);
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
                        r.oldest = r.received.record(&event.id, event.created_at, r.page_limit);
                    }
                }
                if accepted {
                    return Some(event);
                }
            }
            lkjstr_protocol::RelayMessage::Eose(subscription_id) => {
                self.close_delivery_check(relay, &subscription_id);
                let mut close = false;
                let mut first_latency = None;
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
                    first_latency.get_or_insert(now.saturating_sub(r.sent_at));
                    if !r.live {
                        r.complete = true;
                        r.sent = false;
                        close = true;
                    }
                }
                if let Some(latency) = first_latency
                    && let Some(peer) = self.relays.get_mut(relay)
                {
                    peer.latency_ms = Some(
                        peer.latency_ms
                            .map_or(latency, |old| (old * 7 + latency) / 8),
                    );
                }
                if close {
                    self.send(relay, json!(["CLOSE", subscription_id]));
                }
            }
            lkjstr_protocol::RelayMessage::Closed {
                subscription_id,
                message,
            } => {
                self.close_delivery_check(relay, &subscription_id);
                if self.auth_closed(relay, &subscription_id, &message, now) {
                    return None;
                }
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
                if !quality::limited(&message)
                    && self
                        .requests
                        .values()
                        .any(|r| r.relay == relay && r.wire_id == subscription_id && r.sent)
                    && let Some(peer) = self.relays.get_mut(relay)
                {
                    peer.failures = peer.failures.saturating_add(1).min(8);
                }
                for r in self
                    .requests
                    .values_mut()
                    .filter(|r| r.wire_id == subscription_id && r.relay == relay && r.sent)
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
                if require_transport
                    && self.publications.get(&event_id).is_some_and(|p| {
                        p.event.kind == 1 && !p.transport_confirmed.contains(relay)
                    })
                {
                    return None;
                }
                if !self.auth_answer(relay, &event_id, accepted, &message, now)
                    && (accepted || !self.auth_write(relay, &event_id, &message))
                {
                    let before = self.output.len();
                    self.answer_delivery(&event_id, relay, accepted, &message, now);
                    if let Some(Output::Result {
                        req, error: None, ..
                    }) = self.output.get(before)
                    {
                        on_acceptance(req);
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
