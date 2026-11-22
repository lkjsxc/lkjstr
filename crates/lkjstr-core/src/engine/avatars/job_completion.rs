use super::*;
impl Book {
    pub fn complete(&mut self, ticket: Ticket, result: Completion, now: u64) -> Vec<Command> {
        let mut commands = self.expire(now);
        commands.extend(self.settled(ticket, result, now));
        commands
    }
    fn settled(&mut self, ticket: Ticket, result: Completion, now: u64) -> Vec<Command> {
        let Some(job) = self.jobs.get(&ticket.job) else {
            return Vec::new();
        };
        if !job.active || job.stage != ticket.stage {
            return Vec::new();
        }
        if job.owners.is_empty() {
            self.jobs.remove(&ticket.job);
            return vec![Command::Release(ticket.job)];
        }
        let Some(job) = self.jobs.get_mut(&ticket.job) else {
            return Vec::new();
        };
        job.spent = job.spent.saturating_add(now.saturating_sub(job.started));
        job.active = false;
        let id = ticket.job;
        match (ticket.stage, result) {
            (Stage::Lookup, Completion::Hit { bytes })
                if (1..=MAX_DERIVED_BYTES).contains(&bytes) =>
            {
                self.finish(id, ResultKind::Ready { retained: true })
            }
            (Stage::Lookup, Completion::Miss | Completion::StorageUnavailable) => {
                if result == Completion::StorageUnavailable {
                    job.persist = false;
                    self.storage_backoff = now.saturating_add(STORAGE_BACKOFF_MS);
                }
                if self.capability_failed {
                    self.finish(id, Failure::Capability.result())
                } else {
                    job.stage = Stage::Fetch;
                    Vec::new()
                }
            }
            (Stage::Fetch, Completion::Fetched { bytes })
                if (1..=MAX_ORIGINAL_BYTES).contains(&bytes) =>
            {
                job.stage = Stage::Derive;
                Vec::new()
            }
            (Stage::Derive, Completion::Derived { bytes })
                if (1..=MAX_DERIVED_BYTES).contains(&bytes) =>
            {
                if !job.persist || self.storage_backoff > now {
                    self.finish(id, ResultKind::Ready { retained: false })
                } else {
                    job.stage = Stage::Store;
                    Vec::new()
                }
            }
            (Stage::Store, Completion::Stored) => {
                self.finish(id, ResultKind::Ready { retained: true })
            }
            (Stage::Store, Completion::StoreUnavailable) => {
                self.storage_backoff = now.saturating_add(STORAGE_BACKOFF_MS);
                self.finish(id, ResultKind::Ready { retained: false })
            }
            (_, Completion::Cancelled) => self.finish(id, Failure::Transient.result()),
            (_, Completion::Failed(failure)) => {
                let outcome = self.negative(id, failure, now);
                self.finish(id, outcome)
            }
            _ => {
                let outcome = self.negative(id, Failure::Unsupported { uniform: false }, now);
                self.finish(id, outcome)
            }
        }
    }
}
