//! Local I/O completion is not evidence of network absence or page exhaustion.
use super::*;
use crate::cache::Restored;

fn admissible(record: &Record) -> bool {
    if record.raw.len() > 1024 * 1024 {
        return false;
    }
    let Ok(restored) = record.restore() else {
        return false;
    };
    let event = match restored {
        Restored::Verified(event) | Restored::Verify(event) => event,
    };
    record.id == event.id
        && crate::kinds::policy(event.kind).public_reference
        && lkjstr_protocol::verified_nested_repost(&event)
            .is_none_or(|nested| crate::kinds::policy(nested.kind).public_reference)
}
fn bounded(result: &LocalReadResult) -> bool {
    result.completed.len() <= BATCH_IDS
        && result.records.len() <= BATCH_IDS
        && result
            .completed
            .iter()
            .all(|id| lkjstr_protocol::is_event_id(id))
        && result
            .records
            .iter()
            .try_fold(0usize, |bytes, record| {
                bytes
                    .checked_add(record.raw.len())?
                    .checked_add(record.id.len())?
                    .checked_add(record.receipt.as_ref().map_or(0, String::len))
            })
            .is_some_and(|bytes| bytes <= RESULT_BYTES)
}

impl Engine {
    /// Returns false for orphaned, expired or previous-generation callbacks.
    pub fn finish_local_read(
        &mut self,
        job: u64,
        result: Result<LocalReadResult, LocalReadFailure>,
        now: u64,
    ) -> bool {
        if self.reconcile_local_reads(now) {
            self.replan(now);
        }
        if !self.local_reads.live(job, now) {
            return false;
        }
        let members = self.local_reads.members(job, now);
        self.local_reads.jobs.remove(&job);
        let result = result.ok().filter(bounded);
        let completed: BTreeSet<_> = result.as_ref().map_or_else(
            || members.clone(),
            |result| {
                result
                    .completed
                    .iter()
                    .filter(|id| members.contains(*id))
                    .cloned()
                    .collect()
            },
        );
        let mut admitted = BTreeSet::new();
        if let Some(result) = result {
            let records: Vec<_> = result
                .records
                .into_iter()
                .filter(|record| {
                    completed.contains(&record.id)
                        && members.contains(&record.id)
                        && admissible(record)
                        && admitted.insert(record.id.clone())
                })
                .collect();
            // Existing receipts remain fast; legacy rows use the bounded verifier.
            self.restore_cache(&records);
        }
        let queued: BTreeSet<_> = self
            .queue
            .iter()
            .map(|queued| queued.event.id.clone())
            .collect();
        for id in members {
            if let Some(entry) = self.local_reads.entries.get_mut(&id) {
                entry.phase = if !completed.contains(&id) {
                    entry.ready_at = now.saturating_add(25);
                    Phase::Waiting
                } else if admitted.contains(&id)
                    && queued.contains(&id)
                    && self.store.get(&id).is_none()
                {
                    Phase::Verifying
                } else {
                    Phase::Settled(now.saturating_add(MISS_MS))
                };
            }
        }
        self.replan(now);
        true
    }
}
