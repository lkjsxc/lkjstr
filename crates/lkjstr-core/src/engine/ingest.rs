//! Bounded verification queue and exact duplicate resumption observations.
use super::*;
impl Engine {
    pub fn enqueue(&mut self, relay: String, event: NostrEvent) {
        if let Some(known) = self.store.get(&event.id)
            && *known == event
        {
            self.network
                .observe_verified(&relay, &known, self.network.now);
        }
        if self.store.get(&event.id).is_some() || self.queue.iter().any(|(_, e)| *e == event) {
            if let Some(r) = self.network.relays.get_mut(&relay) {
                r.duplicates += 1;
            }
            return;
        }
        let bytes = crate::store::event_payload_bytes(&event);
        if self.queue.len() >= 4096 || self.queue_bytes.saturating_add(bytes) > 8 * 1024 * 1024 {
            self.dropped += 1;
            return;
        }
        self.queue_bytes += bytes;
        // Profiles requested for visible authors precede bulk note verification.
        if event.kind == 0 {
            self.queue.push_front((relay, event));
        } else {
            self.queue.push_back((relay, event));
        }
        self.network.verifying = true;
        self.metrics.verify_queue_peak = self.metrics.verify_queue_peak.max(self.queue.len());
    }
}
