//! Bounded verification queue and exact duplicate resumption observations.
// A few complete signed follow lists can exceed 8 MiB before a WASM tick gets
// time to verify them. Retrying a partially queued 200-event response costs
// far more wire bandwidth than retaining that burst until verification runs.
pub(super) const MAX_VERIFY_QUEUE: usize = 4096;
pub(super) const MAX_VERIFY_QUEUE_BYTES: usize = 32 * 1024 * 1024;
const MAX_PAGE_COPIES: usize = 4;
// At least 24 of each 32-event slice retain FIFO progress under notification spam.
const NOTIFICATION_SLICE_LIMIT: usize = 8;
use super::*;

pub(super) struct QueuedEvent {
    pub(super) relay: String,
    pub(super) event: NostrEvent,
    pub(super) wire: Option<String>,
    pub(super) sequence: u64,
    pub(super) copies: Vec<(String, String)>,
    pub(super) bytes: usize,
    pub(super) observation: Option<network::fetch_records::Receipt>,
}
impl Engine {
    /// Unverified tags are scheduling hints only; every selected event is still verified.
    /// A single bounded queue scan selects at most eight current-account candidates.
    pub(super) fn notification_indices(&self) -> Vec<usize> {
        if self.queue.is_empty() || self.network.optimizer.hidden {
            return vec![];
        }
        let accounts: std::collections::BTreeSet<_> = self
            .discovery_accounts
            .iter()
            .map(String::as_str)
            .chain(
                self.views
                    .values()
                    .filter(|v| {
                        v.visible
                            && (v.query.source == protocol::Source::Notifications
                                || (matches!(
                                    v.query.source,
                                    protocol::Source::Home
                                        | protocol::Source::Global
                                        | protocol::Source::TheirHome
                                ) && v.query.filters.notifications == Some(true)))
                    })
                    .filter_map(|v| v.query.account.as_deref()),
            )
            .collect();
        if accounts.is_empty() {
            return vec![];
        }
        self.queue
            .iter()
            .enumerate()
            .filter(|(_, entry)| {
                matches!(entry.event.kind, 1 | 6 | 7 | 16 | 42 | 9735)
                    && entry.event.tags.iter().any(|tag| {
                        tag.first().is_some_and(|name| name == "p")
                            && tag.get(1).is_some_and(|account| {
                                account != &entry.event.pubkey
                                    && accounts.contains(account.as_str())
                            })
                    })
            })
            .take(NOTIFICATION_SLICE_LIMIT)
            .map(|(index, _)| index)
            .collect()
    }
    pub fn enqueue(&mut self, relay: String, event: NostrEvent) {
        let mut observation = self.network.last_fetch.take();
        if relay == crate::cache::VERIFY_SOURCE || relay == "cache" {
            observation = self
                .network
                .observe_cache_resource(&event, self.network.now);
        }
        let delivery = self
            .network
            .delivery_wire
            .take()
            .filter(|(url, _)| url == &relay);
        let known = self
            .store
            .lease(&event.id)
            .is_some_and(|known| known.matches(&event));
        if known {
            if let Some((_, wire)) = &delivery {
                self.network.confirm_page_event(&relay, wire, &event);
            }
            self.network
                .observe_verified(&relay, &event, self.network.now);
            self.relay_served(&relay, &event.id);
        }
        let duplicate = if known {
            None
        } else {
            self.queue.iter_mut().find(|queued| queued.event == event)
        };
        if known || duplicate.is_some() {
            self.network.observed_receipt(
                observation,
                fetch_records::Outcome::Duplicate,
                Some(0),
                false,
            );
            if let (Some(queued), Some(delivery)) = (duplicate, delivery) {
                let bytes = std::mem::size_of::<(String, String)>()
                    + delivery.0.capacity()
                    + delivery.1.capacity();
                if queued.copies.len() < MAX_PAGE_COPIES
                    && self.queue_bytes.saturating_add(bytes) <= MAX_VERIFY_QUEUE_BYTES
                    && !(queued.relay == delivery.0 && queued.wire.as_ref() == Some(&delivery.1))
                    && !queued.copies.contains(&delivery)
                {
                    queued.copies.reserve_exact(1);
                    queued.copies.push(delivery);
                    queued.bytes += bytes;
                    self.queue_bytes += bytes;
                }
            }
            self.network.repeated_deliveries = self
                .network
                .repeated_deliveries
                .saturating_add(u64::from(relay.starts_with("ws")));
            if let Some(r) = self.network.relays.get_mut(&relay) {
                r.duplicates += 1;
            }
            return;
        }
        let bytes = crate::store::event_payload_bytes(&event);
        // Legacy cache rows bypass the relay frame cap. A row that can never fit
        // persistence must not block every later verification at the queue head.
        if !crate::persistence::PendingEvents::can_ever_admit(&event)
            || self.queue.len() >= MAX_VERIFY_QUEUE
            || self.queue_bytes.saturating_add(bytes) > MAX_VERIFY_QUEUE_BYTES
        {
            self.network.observed_receipt(
                observation,
                fetch_records::Outcome::Dropped,
                Some(0),
                false,
            );
            self.dropped += 1;
            self.network.verification_dropped(&relay, &event);
            return;
        }
        self.queue_bytes += bytes;
        self.delivery_sequence = self.delivery_sequence.saturating_add(1);
        let entry = QueuedEvent {
            relay,
            event,
            wire: delivery.map(|(_, wire)| wire),
            sequence: self.delivery_sequence,
            copies: Vec::new(),
            bytes,
            observation,
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
