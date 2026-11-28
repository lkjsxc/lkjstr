//! Physical request lifecycle and bounded replay history.
use super::*;
const MAX_ATTEMPTS: usize = 1024;
const MAX_REPLAY_KEYS: usize = 4096;
impl Network {
    pub(in crate::engine::network) fn observe_req(
        &mut self,
        relay: &str,
        frame: &Value,
        bytes: usize,
    ) {
        if frame[0] != "REQ" || !self.public_relay(relay) {
            return;
        }
        let Some(wire) = frame[1].as_str() else {
            return;
        };
        let mut rs = self
            .requests
            .values()
            .filter(|r| r.relay == relay && r.wire_id == wire && r.sent);
        let Some(first) = rs.next() else {
            return;
        };
        if !first.observable() {
            return;
        }
        let mut class = first.resource_class();
        for r in rs {
            if !r.observable() {
                return;
            }
            if r.resource_class() != class {
                class = ResourceClass::Mixed;
            }
        }
        let (Some(wire_key), Some(relay_key)) = (self.fetches.key(wire), self.fetches.key(relay))
        else {
            return;
        };
        // Exact transmitted envelope, excluding the ephemeral wire ID. Only its
        // ephemeral hash survives; never retain the filter's search/tags/authors.
        let Some(parts) = frame.as_array() else {
            return;
        };
        let identity = format!(
            "{relay} {}",
            serde_json::to_string(&parts[2..]).unwrap_or_default()
        );
        let Some(mut record) =
            self.fetches
                .draft(class, Scope::Request, &identity, Some(relay), self.now)
        else {
            return;
        };
        first.annotate(&self.fetches, &mut record);
        let peer = &mut self.relays.get_mut(relay).unwrap();
        record.connection = if peer.observed_request {
            Connection::Reused
        } else {
            Connection::New
        };
        peer.observed_request = true;
        record.start_ms = Some(self.now);
        record.wire_bytes = WireBytes::Measured(bytes as u64);
        record.source = Source::Network;
        if !self.fetch_attempts.replay.insert(record.key) {
            self.fetches
                .count(class, |t| t.replays = t.replays.saturating_add(1));
        } else {
            if self.fetch_attempts.order.len() == MAX_REPLAY_KEYS
                && let Some(old) = self.fetch_attempts.order.pop_front()
            {
                self.fetch_attempts.replay.remove(&old);
            }
            self.fetch_attempts.order.push_back(record.key);
        }
        if self.fetch_attempts.active.len() == MAX_ATTEMPTS {
            if let Some(key) = self
                .fetch_attempts
                .active
                .iter()
                .min_by_key(|(_, a)| a.record.start_ms)
                .map(|(&k, _)| k)
            {
                self.finish_attempt(key, self.now, Outcome::Dropped, 0);
                self.flush_attempt(key, true);
            }
        }
        self.fetch_attempts.active.insert(
            wire_key,
            Attempt {
                record,
                relay: relay_key,
                pending: 0,
                yielded: false,
                ended: false,
            },
        );
    }
    fn finish_attempt(&mut self, key: KeyHash, now: u64, outcome: Outcome, bytes: usize) {
        if let Some(a) = self.fetch_attempts.active.get_mut(&key)
            && !a.ended
        {
            a.ended = true;
            a.record.end_ms = now;
            if bytes != 0 {
                a.record.first_byte_ms.get_or_insert(now);
            }
            a.record.outcome = outcome;
            if let WireBytes::Measured(n) = a.record.wire_bytes {
                a.record.wire_bytes = WireBytes::Measured(n.saturating_add(bytes as u64));
            }
            a.record.link_ms = link_cost(
                self.optimizer.link.observed_state(),
                a.record.wire_bytes,
                true,
                a.record.connection,
            );
        }
        self.flush_attempt(key, false);
    }
    pub(super) fn flush_attempt(&mut self, key: KeyHash, force: bool) {
        if self
            .fetch_attempts
            .active
            .get(&key)
            .is_some_and(|a| a.ended && (force || a.pending == 0))
            && let Some(a) = self.fetch_attempts.active.remove(&key)
        {
            if a.record.outcome == Outcome::Ok && !a.yielded && a.pending == 0 {
                self.fetches.count(a.record.class, |t| {
                    t.zero_yield_eose = t.zero_yield_eose.saturating_add(1)
                });
            }
            self.fetches.record(a.record);
        }
    }
    pub(in crate::engine::network) fn observe_end(
        &mut self,
        relay: &str,
        wire: &str,
        now: u64,
        outcome: Outcome,
        bytes: usize,
    ) {
        if let (Some(key), Some(relay)) = (self.fetches.key(wire), self.fetches.key(relay))
            && self
                .fetch_attempts
                .active
                .get(&key)
                .is_some_and(|a| a.relay == relay)
        {
            self.finish_attempt(key, now, outcome, bytes);
        }
    }
    pub(in crate::engine::network) fn observe_disconnect(&mut self, relay: &str, now: u64) {
        let Some(relay) = self.fetches.key(relay) else {
            return;
        };
        let keys: Vec<_> = self
            .fetch_attempts
            .active
            .iter()
            .filter(|(_, a)| a.relay == relay && !a.ended)
            .map(|(&k, _)| k)
            .collect();
        for key in keys {
            self.finish_attempt(key, now, Outcome::Disconnected, 0);
        }
    }
}
