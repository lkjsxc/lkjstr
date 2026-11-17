//! Coalesced owner lifetimes, total deadlines and bounded job allocation.
use super::*;
type Wanted = BTreeMap<String, BTreeSet<String>>;

impl State {
    pub(super) fn pending(&self, id: &str, now: u64) -> bool {
        self.entries.get(id).is_some_and(|entry| {
            !entry.owners.is_empty()
                && now < entry.deadline
                && !matches!(entry.phase, Phase::Settled(_))
        })
    }

    fn member(&self, job: u64, id: &str, generation: u64, now: u64) -> bool {
        self.entries.get(id).is_some_and(|entry| {
            entry.generation == generation
                && !entry.owners.is_empty()
                && entry.phase == Phase::Reading(job)
                && now < entry.deadline
        })
    }

    pub(super) fn live(&self, job: u64, now: u64) -> bool {
        self.enabled
            && self.jobs.get(&job).is_some_and(|work| {
                now < work.deadline
                    && work
                        .members
                        .iter()
                        .any(|(id, generation)| self.member(job, id, *generation, now))
            })
    }

    pub(super) fn members(&self, job: u64, now: u64) -> BTreeSet<String> {
        self.jobs
            .get(&job)
            .into_iter()
            .flat_map(|work| &work.members)
            .filter(|(id, generation)| self.member(job, id, **generation, now))
            .map(|(id, _)| id.clone())
            .collect()
    }

    fn prune(&mut self, now: u64) {
        self.entries.retain(|_, entry| match entry.phase {
            // A failed lookup can recover after the negative-evidence cooldown,
            // even when the same view has stayed open throughout.
            Phase::Settled(until) => now < until,
            _ => !entry.owners.is_empty(),
        });
        let dead: Vec<_> = self
            .jobs
            .keys()
            .filter(|job| !self.live(**job, now))
            .copied()
            .collect();
        for job in dead {
            self.jobs.remove(&job);
        }
    }

    pub(super) fn release(&mut self, owner: &str, now: u64) {
        for entry in self.entries.values_mut() {
            entry.owners.remove(owner);
        }
        self.prune(now);
    }

    pub(super) fn synchronize(
        &mut self,
        wanted: Wanted,
        held: &crate::store::Store,
        queued: &BTreeSet<String>,
        network: &BTreeSet<String>,
        now: u64,
    ) {
        self.prune(now);
        for (id, entry) in &mut self.entries {
            entry.owners = wanted.get(id).cloned().unwrap_or_default();
        }
        self.prune(now);
        for (id, owners) in wanted {
            if self.entries.len() >= TRACKED_IDS {
                break;
            }
            if self.entries.contains_key(&id) || held.get(&id).is_some() || network.contains(&id) {
                continue;
            }
            let Some(generation) = self.next_generation.checked_add(1) else {
                break;
            };
            self.next_generation = generation;
            let phase = if queued.contains(&id) {
                Phase::Verifying
            } else {
                Phase::Waiting
            };
            self.entries.insert(
                id,
                Entry {
                    generation,
                    owners,
                    deadline: now.saturating_add(DEADLINE_MS),
                    ready_at: now,
                    phase,
                },
            );
        }
    }

    pub(super) fn reconcile(
        &mut self,
        held: &crate::store::Store,
        queued: &BTreeSet<String>,
        network: &BTreeSet<String>,
        now: u64,
    ) -> bool {
        if !self.enabled {
            return false;
        }
        let mut changed = false;
        for (id, entry) in &mut self.entries {
            if matches!(entry.phase, Phase::Settled(_)) {
                continue;
            }
            if now >= entry.deadline
                || held.get(id).is_some()
                || network.contains(id)
                || (entry.phase == Phase::Verifying && !queued.contains(id))
            {
                entry.phase = Phase::Settled(now.saturating_add(MISS_MS));
                changed = true;
            } else if queued.contains(id) && entry.phase != Phase::Verifying {
                entry.phase = Phase::Verifying;
                changed = true;
            }
        }
        let remaining = self.entries.len();
        self.prune(now);
        changed || self.entries.len() != remaining
    }

    pub(super) fn drain(&mut self, now: u64) -> Vec<LocalRead> {
        let mut output = Vec::new();
        if !self.enabled {
            return output;
        }
        while self.jobs.len() < MAX_JOBS {
            let mut waiting: Vec<_> = self
                .entries
                .iter()
                .filter(|(_, entry)| {
                    entry.phase == Phase::Waiting
                        && !entry.owners.is_empty()
                        && entry.ready_at <= now
                        && now < entry.deadline
                })
                .map(|(id, entry)| (entry.deadline, id.clone()))
                .collect();
            waiting.sort();
            let ids: Vec<_> = waiting
                .into_iter()
                .take(BATCH_IDS)
                .map(|(_, id)| id)
                .collect();
            if ids.is_empty() {
                break;
            }
            let Some(job) = self.next_job.checked_add(1) else {
                break;
            };
            self.next_job = job;
            let deadline = ids
                .iter()
                .filter_map(|id| self.entries.get(id).map(|e| e.deadline))
                .min()
                .unwrap_or(now);
            let mut members = BTreeMap::new();
            for id in &ids {
                if let Some(entry) = self.entries.get_mut(id) {
                    entry.deadline = deadline;
                    entry.phase = Phase::Reading(job);
                    members.insert(id.clone(), entry.generation);
                }
            }
            self.jobs.insert(job, Job { deadline, members });
            output.push(LocalRead {
                job,
                ids,
                deadline,
                max_bytes: RESULT_BYTES,
            });
        }
        output
    }
}
