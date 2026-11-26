//! Deletion ownership and independent retention bounds for notes and metadata.
use lkjstr_protocol::{NostrEvent, tags::tag_values};

use super::{MAX_DELETED, Store, decode_id};

impl Store {
    pub(crate) fn discard_unseen_note(&mut self, id: &str) -> bool {
        if self.seen_on(id).is_empty() && self.lease(id).is_some_and(|event| event.kind == 1) {
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
                .lease(&target)
                .is_some_and(|e| e.kind == 5 || e.pubkey_hex() != deletion.pubkey)
            {
                continue;
            }
            if decode_id(&target).is_some_and(|id| self.events.contains_key(&id))
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
        let before = self.evictions;
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
                .filter_map(|key| {
                    let e = &key.0;
                    (super::weighted::replaceable(e.kind) == replaceable
                        && !self.context_pins.contains(&e.id_hex()))
                    .then(|| e.id_hex())
                })
                .take(count.saturating_sub(cap))
                .collect();
            for id in victims {
                self.evict_one(&id);
            }
        }
        // Count eviction or a previous removal can leave dictionary-only
        // symbols charged. Reclaim them before selecting a byte-pressure victim.
        if self.managed_bytes() > self.byte_cap {
            self.compact.reap();
        }
        while self.managed_bytes() > self.byte_cap {
            let Some(id) = self
                .by_time
                .iter()
                .find(|key| !self.context_pins.contains(&key.0.id_hex()))
                .map(|key| key.0.id_hex())
            else {
                break;
            };
            self.evict_one(&id);
            // The next byte decision must observe the victim's released symbols.
            // Outstanding persistence leases still keep their symbols charged.
            self.compact.reap();
        }
        if self.evictions != before {
            self.compact.reap();
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
        self.lease(id).is_none() && self.evicted.contains_key(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_pressure_reaps_dead_symbols_before_removing_another_note() {
        let note = |id: u64, tags: Vec<Vec<String>>| NostrEvent {
            id: format!("{id:064x}"),
            pubkey: "a".repeat(64),
            created_at: id,
            kind: 1,
            tags,
            content: "retained note".into(),
            sig: "b".repeat(128),
        };
        let old = note(
            1,
            (0..128)
                .map(|i| vec!["x".into(), format!("unique-{i:04}-{}", "x".repeat(80))])
                .collect(),
        );
        let keep = note(2, vec![]);
        let filled = || {
            let mut store = Store::new(8);
            store.insert(old.clone(), None);
            store.insert(keep.clone(), None);
            store
        };
        // An independent single-victim operation establishes the sufficient
        // budget, including its retained fence and index capacity on this target.
        let mut reference = filled();
        reference.evict_one(&old.id);
        reference.compact.reap();
        let cap = reference.managed_bytes();
        assert_eq!(reference.len(), 1);
        for count_cap in [8, 1] {
            let mut actual = filled();
            actual.cap = count_cap;
            let actual = actual.with_byte_cap(cap);
            assert_eq!(actual.evictions(), 1);
            assert_eq!(actual.len(), 1);
            assert!(actual.lease(&keep.id).is_some());
            assert!(actual.lease(&old.id).is_none());
            assert!(actual.managed_bytes() <= cap);
        }
    }
}
