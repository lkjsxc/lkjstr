//! Pending leases only. Finished Blobs belong to the page or IndexedDB, never this book.
use super::{MAX_DERIVED_BYTES, MAX_ORIGINAL_BYTES, host};
use std::collections::{BTreeMap, BTreeSet};
#[path = "job_admission.rs"]
mod admission;
#[path = "job_completion.rs"]
mod completion;
#[path = "job_schedule.rs"]
mod schedule;
#[path = "job_types.rs"]
mod types;
pub use types::*;
pub const MAX_REQUEST_BYTES: usize = 128;
pub const MAX_OWNERS: usize = 4096;
pub const MAX_CLIENT_OWNERS: usize = 512;
pub const MAX_CLIENT_URLS: usize = 256;
pub const MAX_JOBS: usize = 1024;
pub const MAX_NEGATIVES: usize = 512;
pub const RAW_SLOTS: usize = 4;
pub const DERIVED_SLOTS: usize = 4;
pub const ACTIVE_MS: u64 = 15_000;
pub const STORAGE_BACKOFF_MS: u64 = 60_000;
#[derive(Clone, Debug)]
struct Job {
    key: String,
    host: String,
    owners: BTreeSet<Owner>,
    stage: Stage,
    active: bool,
    started: u64,
    deadline: u64,
    spent: u64,
    persist: bool,
}
impl Job {
    fn ticket(&self, id: u64) -> Ticket {
        Ticket {
            job: id,
            stage: self.stage,
        }
    }
    fn raw(&self) -> bool {
        self.stage == Stage::Fetch && self.active || self.stage == Stage::Derive
    }
    fn derived(&self) -> bool {
        self.stage == Stage::Derive && self.active || self.stage == Stage::Store
    }
}
#[derive(Clone, Copy, Debug)]
struct Negative {
    failure: Failure,
    until: u64,
}
/// All collections are bounded by the constants above; retiring active effects remain in jobs.
#[derive(Default)]
pub struct Book {
    next: u64,
    owners: BTreeMap<Owner, u64>,
    urls: BTreeMap<String, u64>,
    jobs: BTreeMap<u64, Job>,
    negatives: BTreeMap<String, Negative>,
    capability_failed: bool,
    storage_backoff: u64,
}
impl Book {
    pub fn counts(&self) -> Counts {
        let mut counts = Counts {
            owners: self.owners.len(),
            jobs: self.jobs.len(),
            negatives: self.negatives.len(),
            ..Counts::default()
        };
        for job in self.jobs.values() {
            counts.raw += usize::from(job.raw());
            counts.derived += usize::from(job.derived());
            if job.active {
                match job.stage {
                    Stage::Lookup => counts.lookups += 1,
                    Stage::Fetch => counts.fetches += 1,
                    Stage::Derive => counts.derives += 1,
                    Stage::Store => counts.stores += 1,
                }
            }
        }
        counts
    }
    pub fn current(&self, ticket: Ticket) -> bool {
        self.jobs
            .get(&ticket.job)
            .is_some_and(|job| job.active && job.stage == ticket.stage && !job.owners.is_empty())
    }
    fn unmap(&mut self, id: u64) {
        if let Some(job) = self.jobs.get(&id)
            && self.urls.get(&job.key) == Some(&id)
        {
            self.urls.remove(&job.key);
        }
    }
    fn reply(&mut self, id: u64, result: ResultKind) -> Vec<Command> {
        self.unmap(id);
        let Some(job) = self.jobs.get_mut(&id) else {
            return Vec::new();
        };
        std::mem::take(&mut job.owners)
            .into_iter()
            .map(|owner| {
                self.owners.remove(&owner);
                Command::Reply {
                    owner,
                    job: Some(id),
                    result,
                }
            })
            .collect()
    }
    fn finish(&mut self, id: u64, result: ResultKind) -> Vec<Command> {
        let mut commands = self.reply(id, result);
        self.jobs.remove(&id);
        commands.push(Command::Release(id));
        commands
    }
    fn negative(&mut self, id: u64, failure: Failure, now: u64) -> ResultKind {
        if failure == Failure::Capability {
            self.capability_failed = true;
        }
        self.negatives.retain(|_, value| value.until > now);
        if self.negatives.len() == MAX_NEGATIVES
            && let Some(key) = self
                .negatives
                .iter()
                .min_by_key(|(_, value)| value.until)
                .map(|(key, _)| key.clone())
        {
            self.negatives.remove(&key);
        }
        let duration = if failure == Failure::Transient {
            30_000
        } else {
            600_000
        };
        if let Some(job) = self.jobs.get(&id) {
            self.negatives.insert(
                job.key.clone(),
                Negative {
                    failure,
                    until: now.saturating_add(duration),
                },
            );
        }
        failure.result()
    }
}
