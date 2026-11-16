use super::super::{Failure, Providers, Result, Target};
use super::{Entry, MAX_RECEIPTS, Receipts};
use crate::store::Store;
use std::{collections::BTreeSet, sync::Arc};

impl Receipts {
    /// Include all retained candidates, not one target at a time. Fully validated
    /// history keeps its original observation across current-provider rotations.
    pub fn sync(
        &mut self,
        store: &Store,
        providers: &Providers,
        candidates: &[String],
        now: u64,
    ) -> Result<()> {
        let active: BTreeSet<_> = candidates
            .iter()
            .filter(|id| store.get(id).is_some_and(|e| e.kind == 9735))
            .cloned()
            .collect();
        if active.len() > MAX_RECEIPTS {
            return Err(Failure::TooLarge);
        }
        let removed: Vec<_> = self
            .entries
            .keys()
            .filter(|id| !active.contains(*id))
            .cloned()
            .collect();
        for id in removed {
            self.remove_entry(&id);
            self.revision = self.revision.saturating_add(1);
        }
        self.identities.retain(|proof| Arc::strong_count(proof) > 1);
        for id in active {
            let Some(raw) = store.get(&id) else {
                continue;
            };
            if !self.entries.contains_key(&id) {
                self.insert_entry(id.clone(), Entry::new(&raw));
                self.revision = self.revision.saturating_add(1);
            }
            let Some(entry) = self.entries.get(&id) else {
                continue;
            };
            if entry.checked.as_ref().is_some_and(|c| c.result.is_ok()) {
                self.attach(&id);
                continue;
            }
            let proof = entry
                .recipient
                .as_deref()
                .and_then(|r| providers.get(store, r, now));
            let Some(proof) = proof else {
                self.unqueue(&id);
                continue;
            };
            let checked = entry.checked.as_ref();
            let same = checked
                .and_then(|c| c.attempt.upgrade())
                .is_some_and(|previous| Arc::ptr_eq(&proof, &previous));
            let retry = checked.is_some_and(|c| match c.result {
                Err(Failure::NotFound) => entry
                    .target
                    .as_ref()
                    .is_some_and(|t| matches!(t, Target::Event { id } if store.get(id).is_some())),
                Err(Failure::Stale) => c.at < now && raw.created_at <= now.saturating_add(60),
                Err(Failure::TooLarge) => {
                    c.retry_capacity && self.identities.len() < super::MAX_HISTORICAL_IDENTITIES
                }
                _ => false,
            });
            let immutable_rejection = checked
                .is_some_and(|c| matches!(c.result, Err(Failure::Rejected | Failure::Unsupported)));
            if !immutable_rejection && (!same || retry) {
                self.queue(&id)?;
            }
        }
        Ok(())
    }
}
