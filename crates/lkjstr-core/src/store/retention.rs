//! Deletion ownership and independent retention bounds for notes and metadata.
use lkjstr_protocol::{NostrEvent, tags::tag_values};

use super::{MAX_DELETED, Store};

impl Store {
    pub(crate) fn discard_unseen_note(&mut self, id: &str) -> bool {
        if self.seen_on(id).is_empty() && self.events.get(id).is_some_and(|event| event.kind == 1) {
            self.revision += 1;
            self.remove(id);
            return true;
        }
        false
    }

    /// Retention losses can leave additional persisted history outside this store.
    pub fn evictions(&self) -> u64 {
        self.evictions
    }

    pub(super) fn apply_deletion(&mut self, deletion: &NostrEvent) {
        self.apply_address_deletion(deletion);
        for target in tag_values(deletion, "e") {
            if self
                .events
                .get(&target)
                .is_some_and(|e| e.pubkey != deletion.pubkey)
            {
                continue;
            }
            if self.events.contains_key(&target)
                || self.expired_author(&target) == Some(deletion.pubkey.as_str())
                || self
                    .evicted
                    .get(&target)
                    .is_some_and(|fence| fence.author == deletion.pubkey)
            {
                self.apply_verified_deletion(&target);
            }
            if self.deleted.len() < MAX_DELETED {
                self.deleted.insert((target, deletion.pubkey.clone()));
            }
        }
    }

    pub(super) fn evict(&mut self) {
        for (replaceable, cap) in [(false, self.cap), (true, self.replaceable_cap)] {
            let count = if replaceable {
                self.replaceable.len() + self.addressable.len()
            } else {
                self.events.len() - self.replaceable.len() - self.addressable.len()
            };
            if count <= cap {
                continue;
            }
            let victims: Vec<String> = self
                .by_time
                .iter()
                .filter_map(|(_, id)| {
                    let e = self.events.get(id)?;
                    (super::weighted::replaceable(e.kind) == replaceable
                        && !self.context_pins.contains(id))
                    .then(|| id.clone())
                })
                .take(count.saturating_sub(cap))
                .collect();
            for id in victims {
                self.evict_one(&id);
            }
        }
        while self.payload_bytes > self.byte_cap {
            let Some((_, id)) = self
                .by_time
                .iter()
                .find(|(_, id)| !self.context_pins.contains(id))
                .cloned()
            else {
                break;
            };
            self.evict_one(&id);
        }
    }
    pub(super) fn evict_one(&mut self, id: &str) {
        let Some(event) = self.get(id) else { return };
        self.revision = self.revision.saturating_add(1);
        self.remove(id);
        self.evictions = self.evictions.saturating_add(1);
        self.remember_eviction(&event);
    }

    pub fn was_evicted(&self, id: &str) -> bool {
        !self.events.contains_key(id) && self.evicted.contains_key(id)
    }
}
