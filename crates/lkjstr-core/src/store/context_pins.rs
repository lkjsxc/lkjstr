//! A committed read context is a bounded retention floor, never a deletion veto.
use super::*;
use crate::cache::{
    Record, Restored,
    context::{CONTEXT_BYTES, CONTEXT_RECORDS},
};

impl Store {
    /// A deletion request alone proves no ownership. This set is populated only
    /// when the original verified body or a checked read context binds its author.
    pub fn verified_deleted(&self, id: &str) -> bool {
        self.verified_deleted.contains_key(id)
    }
    pub(crate) fn confirm_verified_deletion(&mut self, id: &str) {
        if self.verified_deleted.contains_key(id) {
            return;
        }
        if self.verified_deleted.len() >= MAX_DELETED
            && let Some(old) = self
                .verified_deleted
                .iter()
                .min_by_key(|(id, at)| (**at, *id))
                .map(|(id, _)| id.clone())
        {
            self.verified_deleted.remove(&old);
        }
        // A late original body can prove an older fence without inserting an
        // event. Wake held projections on this bounded evidence-only change.
        self.revision = self.revision.saturating_add(1);
        self.verified_deleted.insert(id.to_owned(), self.revision);
    }

    /// Replace the entire pin set atomically. The journal already budgets whole
    /// contexts; verify the public receipts again at this in-memory boundary.
    pub fn pin_contexts(&mut self, rows: &[Record]) -> Result<(), &'static str> {
        let mut pins = HashSet::new();
        let mut deleted = HashSet::new();
        let mut bytes = 0_usize;
        for row in rows {
            let Ok(Restored::Verified(event)) = row.restore() else {
                return Err("unverified read context pin");
            };
            if event.kind == 5 {
                deleted.extend(
                    tag_values(&event, "e")
                        .into_iter()
                        .filter(|id| lkjstr_protocol::is_event_id(id))
                        .map(|id| (id, event.pubkey.clone())),
                );
            }
            if pins.insert(event.id.clone()) {
                bytes = bytes.saturating_add(event_payload_bytes(&event));
            }
            if pins.len() > CONTEXT_RECORDS || bytes > CONTEXT_BYTES {
                return Err("read context pins exceed budget");
            }
        }
        self.context_pins = pins;
        self.context_deleted = deleted;
        if !self.weighted {
            self.evict();
        }
        Ok(())
    }

    /// Retained signed fences remain effective even when the ordinary tombstone
    /// index is full. A different author's deletion cannot suppress the event.
    pub fn was_deleted(&self, id: &str, author: &str) -> bool {
        // Empty evidence indexes need no owned lookup keys or identity decoding.
        let deleted = (!self.deleted.is_empty()
            && self.deleted.contains(&(id.to_owned(), author.to_owned())))
            || (!self.context_deleted.is_empty()
                && self
                    .context_deleted
                    .contains(&(id.to_owned(), author.to_owned())))
            || (!self.by_tag_e.is_empty()
                && decode_id(id)
                    .and_then(|id| self.by_tag_e.get(&id))
                    .into_iter()
                    .flatten()
                    .any(|event| {
                        event.kind == 5
                            && event.pubkey_hex() == author
                            && event.tag_values("e").any(|target| target == id)
                    }));
        deleted && self.lease(id).is_none_or(|event| event.kind != 5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fresh_deletion_proofs_do_not_starve_after_the_ledger_fills() {
        let mut store = Store::new(0);
        for n in 0..=MAX_DELETED {
            store.confirm_verified_deletion(&format!("{n:064x}"));
        }
        assert_eq!(store.verified_deleted.len(), MAX_DELETED);
        assert!(!store.verified_deleted(&format!("{:064x}", 0)));
        assert!(store.verified_deleted(&format!("{MAX_DELETED:064x}")));
        assert_eq!(store.revision(), (MAX_DELETED + 1) as u64);
    }
}
