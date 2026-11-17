//! Restore historical checked verdicts without rediscovering today's provider.
use super::*;
use crate::cache::{Record, context::Context, zaps::ReceiptRecord};

impl Receipts {
    pub(crate) fn context_ids(&self, store: &Store, ids: &mut BTreeSet<String>) {
        for id in ids.clone() {
            if !store.get(&id).is_some_and(|raw| raw.kind == 9735) {
                continue;
            }
            if let Some(Ok(value)) = self
                .entries
                .get(&id)
                .and_then(|entry| entry.checked.as_ref())
                .map(|c| &c.result)
                && let Some(group) = self.groups.get(&value.payment_key())
            {
                ids.extend(
                    group
                        .iter()
                        .filter(|(_, id)| store.get(id).is_some())
                        .map(|(_, id)| id.clone()),
                );
            }
        }
    }
    pub fn cached(&self, store: &Store, id: &str) -> Option<ReceiptRecord> {
        let entry = self.entries.get(id)?;
        let row = Record::verified(store.get(id)?.as_ref()).ok()?;
        ReceiptRecord::new(&row, entry.checked.as_ref().map(|value| &value.result))
    }
    pub fn checkpoint(&self, store: &Store, context: &mut Context) -> Result<()> {
        self.checkpoint_bounded(store, context, crate::cache::context::Limits::default())
    }
    pub(crate) fn checkpoint_bounded(
        &self,
        store: &Store,
        context: &mut Context,
        limits: crate::cache::context::Limits,
    ) -> Result<()> {
        let mut ids: BTreeSet<_> = context.rows.iter().map(|row| row.id.clone()).collect();
        self.context_ids(store, &mut ids);
        if ids.len() > limits.records
            || ids
                .iter()
                .filter_map(|id| store.get(id))
                .map(|event| crate::store::event_payload_bytes(&event))
                .sum::<usize>()
                > limits.bytes
        {
            return Err(Failure::TooLarge);
        }
        let mut rows: BTreeMap<_, _> = context
            .rows
            .iter()
            .map(|row| (row.id.clone(), row.clone()))
            .collect();
        let mut zaps = Vec::new();
        for id in ids {
            let Some(raw) = store.get(&id).filter(|raw| raw.kind == 9735) else {
                continue;
            };
            rows.insert(
                id.clone(),
                Record::verified(&raw).map_err(|_| Failure::Rejected)?,
            );
            if let Some(record) = self.cached(store, &id) {
                zaps.push(record);
            }
        }
        context
            .set_records(rows.into_values().collect(), zaps)
            .map_err(|_| Failure::TooLarge)
    }
    pub fn restore_checked(&mut self, store: &Store, records: &[ReceiptRecord]) -> Result<()> {
        for record in records {
            if self
                .cached(store, &record.id)
                .is_some_and(|known| known.digest == record.digest)
            {
                continue;
            }
            let Some(raw) = store.get(&record.id) else {
                continue;
            };
            let row = Record::verified(&raw).map_err(|_| Failure::Rejected)?;
            record.checked(&row).map_err(|_| Failure::Rejected)?;
            let Some(mut result) = record.verdict() else {
                continue;
            };
            if let Ok(value) = &mut result {
                if let Some(proof) = self.identities.get(&value.proof) {
                    value.proof = proof.clone();
                } else if self.identities.len() < MAX_HISTORICAL_IDENTITIES {
                    self.identities.insert(value.proof.clone());
                } else {
                    return Err(Failure::TooLarge);
                }
            }
            if !self.entries.contains_key(&record.id) {
                if self.entries.len() >= MAX_RECEIPTS {
                    return Err(Failure::TooLarge);
                }
                self.insert_entry(record.id.clone(), Entry::new(&raw));
            }
            self.detach(&record.id);
            self.unqueue(&record.id);
            if let Some(entry) = self.entries.get_mut(&record.id) {
                entry.checked = Some(Checked {
                    attempt: Weak::new(),
                    at: result.as_ref().map_or(0, |value| value.verified_at),
                    result,
                    retry_capacity: false,
                });
            }
            self.attach(&record.id);
            self.revision = self.revision.saturating_add(1);
        }
        Ok(())
    }
}
