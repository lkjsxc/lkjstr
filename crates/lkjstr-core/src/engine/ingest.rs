//! Bounded verification queue and exact duplicate resumption observations.
// A few complete signed follow lists can exceed 8 MiB before a WASM tick gets
// time to verify them. Retrying a partially queued 200-event response costs
// far more wire bandwidth than retaining that burst until verification runs.
pub(super) const MAX_VERIFY_QUEUE: usize = 4096;
pub(super) const MAX_VERIFY_QUEUE_BYTES: usize = 32 * 1024 * 1024;
use super::*;

pub(super) struct QueuedEvent {
    pub(super) relay: String,
    pub(super) event: NostrEvent,
    pub(super) wire: Option<String>,
    pub(super) sequence: u64,
}
impl Engine {
    pub fn enqueue(&mut self, relay: String, event: NostrEvent) {
        let delivery = self
            .network
            .delivery_wire
            .take()
            .filter(|(url, _, _)| url == &relay);
        let known = self.store.get(&event.id).filter(|known| **known == event);
        if let Some(known) = &known {
            self.network
                .observe_verified(&relay, known, self.network.now);
        }
        if known.is_some() || self.queue.iter().any(|queued| queued.event == event) {
            self.network.repeated_deliveries = self
                .network
                .repeated_deliveries
                .saturating_add(u64::from(relay.starts_with("ws")));
            if let Some(r) = self.network.relays.get_mut(&relay) {
                r.duplicates += 1;
                self.network.telemetry.traffic(self.network.now, |b| {
                    b.duplicates += 1;
                    b.duplicate_bytes += delivery.as_ref().map_or(0, |(_, _, bytes)| *bytes as u64);
                });
            }
            return;
        }
        let bytes = crate::store::event_payload_bytes(&event);
        if self.queue.len() >= MAX_VERIFY_QUEUE
            || self.queue_bytes.saturating_add(bytes) > MAX_VERIFY_QUEUE_BYTES
        {
            self.dropped += 1;
            self.network.verification_dropped(&relay, &event);
            return;
        }
        self.queue_bytes += bytes;
        self.delivery_sequence = self.delivery_sequence.saturating_add(1);
        let entry = QueuedEvent {
            relay,
            event,
            wire: delivery.map(|(_, wire, _)| wire),
            sequence: self.delivery_sequence,
        };
        // Profiles requested for visible authors precede bulk note verification.
        if entry.event.kind == 0 {
            self.queue.push_front(entry);
        } else {
            self.queue.push_back(entry);
        }
        self.network.verifying = true;
        self.metrics.verify_queue_peak = self.metrics.verify_queue_peak.max(self.queue.len());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn large_follower_answer_waits_for_verification_without_replay_and_stays_bounded() {
        let mut engine = Engine::new();
        let make = |i: u64| NostrEvent {
            id: format!("{i:064x}"),
            pubkey: "a".repeat(64),
            created_at: i,
            kind: 3,
            tags: vec![vec!["p".into(), "b".repeat(64)]],
            content: "x".repeat(72 * 1024),
            sig: "0".repeat(128),
        };
        // A burst of more than 12 MiB was previously dropped and the whole
        // shared physical REQ retried. A 32 MiB queue can drain it in slices.
        for i in 0..200 {
            engine.enqueue("wss://relay.test/".into(), make(i));
        }
        assert_eq!(engine.dropped, 0);
        assert_eq!(engine.queue.len(), 200);
        assert!(engine.queue_bytes > 8 * 1024 * 1024);
        assert!(engine.queue_bytes < MAX_VERIFY_QUEUE_BYTES);

        // An unbounded or malicious relay still cannot consume arbitrary RAM.
        for i in 200..650 {
            engine.enqueue("wss://relay.test/".into(), make(i));
        }
        assert!(engine.dropped > 0);
        assert!(engine.queue_bytes <= MAX_VERIFY_QUEUE_BYTES);
    }
}
