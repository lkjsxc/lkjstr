//! Optional exact-ID disk reads. The core owns policy; a host only executes jobs.
use super::Engine;
use crate::cache::Record;
use std::collections::{BTreeMap, BTreeSet};

#[path = "local_read_finish.rs"]
mod finish;
#[path = "local_read_plan.rs"]
mod plan;
#[path = "local_read_state.rs"]
mod state;
#[cfg(test)]
#[path = "local_reads_state_test.rs"]
mod state_tests;
#[cfg(test)]
#[path = "local_reads_test.rs"]
mod tests;

pub const BATCH_IDS: usize = 32;
pub const MAX_JOBS: usize = 2;
pub const TRACKED_IDS: usize = 2048;
pub const DEADLINE_MS: u64 = 500;
pub const MISS_MS: u64 = 30_000;
pub const RESULT_BYTES: usize = 4 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalRead {
    pub job: u64,
    pub ids: Vec<String>,
    pub deadline: u64,
    pub max_bytes: usize,
}
#[derive(Default)]
pub struct LocalReadResult {
    /// Finished gets, including absent/invalid rows; excludes an unread suffix.
    pub completed: Vec<String>,
    pub records: Vec<Record>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LocalReadFailure {
    Unavailable,
    Failed,
    Cancelled,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Waiting,
    Reading(u64),
    Verifying,
    Settled(u64),
}
struct Entry {
    generation: u64,
    owners: BTreeSet<String>,
    deadline: u64,
    ready_at: u64,
    phase: Phase,
}
struct Job {
    deadline: u64,
    members: BTreeMap<String, u64>,
}
/// At most 2048 IDs (including cooldowns), two jobs and 32 members per job.
/// Owner strings come only from the engine's bounded current want registry.
#[derive(Default)]
pub(super) struct State {
    enabled: bool,
    next_job: u64,
    next_generation: u64,
    entries: BTreeMap<String, Entry>,
    jobs: BTreeMap<u64, Job>,
}

impl Engine {
    /// Opt in only after durable storage is ready; native/default hosts stay off.
    pub fn set_local_reads_enabled(&mut self, enabled: bool, now: u64) {
        if self.local_reads.enabled == enabled {
            return;
        }
        self.local_reads.enabled = enabled;
        self.local_reads.entries.clear();
        self.local_reads.jobs.clear();
        // Counters never reset: a callback from a previous opt-in stays stale.
        self.replan(now);
    }

    pub fn drain_local_reads(&mut self, now: u64) -> Vec<LocalRead> {
        if self.reconcile_local_reads(now) {
            self.replan(now);
        }
        self.local_reads.drain(now)
    }

    /// A shared batch stays live while at least one original member still wants it.
    pub fn local_read_live(&self, job: u64, now: u64) -> bool {
        self.local_reads.live(job, now)
    }

    pub(in crate::engine) fn release_local_read_owner(&mut self, sub: &str, now: u64) {
        self.local_reads.release(sub, now);
    }

    pub(in crate::engine) fn revoke_local_reads(&mut self, now: u64) {
        self.local_reads.jobs.clear();
        for entry in self.local_reads.entries.values_mut() {
            entry.phase = Phase::Settled(now.saturating_add(MISS_MS));
        }
    }
}
