//! Deletion ownership and independent retention bounds for notes and metadata.
use lkjstr_protocol::{NostrEvent, is_replaceable_kind, tags::tag_values};

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
            {
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
    fn evict_one(&mut self, id: &str) {
        self.remove(id);
        self.evictions = self.evictions.saturating_add(1);
        if self.evicted.len() >= MAX_DELETED
            && !self.evicted.contains_key(id)
            && let Some(oldest) = self
                .evicted
                .iter()
                .min_by_key(|(id, n)| (**n, *id))
                .map(|(id, _)| id.clone())
        {
            self.evicted.remove(&oldest);
        }
        self.evicted.insert(id.into(), self.evictions);
    }

    pub fn was_evicted(&self, id: &str) -> bool {
        !self.events.contains_key(id) && self.evicted.contains_key(id)
    }
}
