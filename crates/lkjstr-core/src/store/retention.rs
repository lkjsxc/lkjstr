//! Deletion ownership and independent retention bounds for notes and metadata.
use lkjstr_protocol::{NostrEvent, is_replaceable_kind, tags::tag_values};

use super::{MAX_DELETED, Store};

impl Store {
    /// Retention losses can leave additional persisted history outside this store.
    pub fn evictions(&self) -> u64 {
        self.evictions
    }

    pub(super) fn apply_deletion(&mut self, deletion: &NostrEvent) {
        for target in tag_values(deletion, "e") {
            if self
                .events
                .get(&target)
                .is_some_and(|e| e.pubkey != deletion.pubkey)
            {
                continue;
            }
            if self.events.contains_key(&target) {
                self.confirm_verified_deletion(&target);
            }
            self.remove(&target);
            if self.deleted.len() < MAX_DELETED {
                self.deleted.insert((target, deletion.pubkey.clone()));
            }
        }
    }

    pub(super) fn evict(&mut self) {
        for (replaceable, cap) in [(false, self.cap), (true, self.replaceable_cap)] {
            let count = if replaceable {
                self.replaceable.len()
            } else {
                self.events.len() - self.replaceable.len()
            };
            if count <= cap {
                continue;
            }
            let victims: Vec<String> = self
                .by_time
                .iter()
                .filter_map(|(_, id)| {
                    let e = self.events.get(id)?;
                    (is_replaceable_kind(e.kind) == replaceable && !self.context_pins.contains(id))
                        .then(|| id.clone())
                })
                .take(count.saturating_sub(cap))
                .collect();
            for id in victims {
                self.remove(&id);
                self.evictions += 1;
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
            self.remove(&id);
            self.evictions += 1;
        }
    }
}
