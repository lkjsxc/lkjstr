use super::*;
impl Book {
    /// Queue time consumes no active budget. Raw and derived credits cover queued payloads too.
    pub fn pump(&mut self, now: u64) -> Vec<Command> {
        let mut commands = self.expire(now);
        // On-screen faces first, then the next rows, then the rest; oldest first within a place.
        let mut ids: Vec<_> = self.jobs.iter().map(|(id, job)| (job.rank, *id)).collect();
        ids.sort_unstable();
        let ids: Vec<_> = ids.into_iter().map(|(_, id)| id).collect();
        for id in ids {
            let Some(job) = self.jobs.get(&id) else {
                continue;
            };
            if job.owners.is_empty() {
                continue;
            }
            if self.capability_failed && matches!(job.stage, Stage::Fetch | Stage::Derive) {
                let ticket = job.ticket(id);
                if job.active {
                    commands.extend(self.reply(id, Failure::Capability.result()));
                    commands.push(Command::Abort(ticket));
                } else {
                    commands.extend(self.finish(id, Failure::Capability.result()));
                }
                continue;
            }
            if job.active {
                continue;
            }
            if job.spent >= ACTIVE_MS {
                let result = self.negative(id, Failure::Transient, now);
                commands.extend(self.finish(id, result));
                continue;
            }
            let counts = self.counts();
            let permitted = match job.stage {
                Stage::Lookup => counts.lookups < 4,
                Stage::Fetch => {
                    // Rows ahead never take the last slots from faces on screen.
                    let reserve = usize::from(job.rank) * 2;
                    counts.raw + reserve < RAW_SLOTS
                        && self
                            .jobs
                            .values()
                            .filter(|other| {
                                other.active
                                    && other.stage == Stage::Fetch
                                    && other.host == job.host
                            })
                            .count()
                            < HOST_FETCHES - reserve.min(3)
                }
                Stage::Derive => counts.derives == 0 && counts.derived < DERIVED_SLOTS,
                Stage::Store => counts.stores < 4,
            };
            if !permitted {
                continue;
            }
            if job.observe_public && self.fetches.decisions_enabled() {
                self.fetches.decision(
                    crate::engine::fetch_records::Action::Fetch,
                    now,
                    self.jobs
                        .values()
                        .filter(|other| {
                            other.observe_public
                                && !other.active
                                && !other.owners.is_empty()
                                && other.stage == job.stage
                        })
                        .map(|other| (other.key.as_str(), None)),
                    std::iter::once(job.key.as_str()),
                );
            }
            let Some(job) = self.jobs.get_mut(&id) else {
                continue;
            };
            let stage_ms = match job.stage {
                Stage::Lookup | Stage::Store => 3_000,
                _ => 10_000,
            };
            let timeout_ms = stage_ms.min(ACTIVE_MS - job.spent);
            job.active = true;
            job.started = now;
            job.deadline = now.saturating_add(timeout_ms);
            commands.push(Command::Run(Work {
                ticket: job.ticket(id),
                key: job.key.clone(),
                timeout_ms,
            }));
        }
        commands
    }
    /// Deadline invalidates delivery now; the permit remains held until the actual effect settles.
    pub fn expire(&mut self, now: u64) -> Vec<Command> {
        let expired: Vec<_> = self
            .jobs
            .iter()
            .filter(|(_, job)| job.active && !job.owners.is_empty() && job.deadline <= now)
            .map(|(id, _)| *id)
            .collect();
        let mut commands = Vec::new();
        for id in expired {
            let ticket = self.jobs[&id].ticket(id);
            let result = if ticket.stage == Stage::Store {
                self.storage_backoff = now.saturating_add(STORAGE_BACKOFF_MS);
                ResultKind::Ready { retained: false }
            } else {
                let failure = if ticket.stage == Stage::Derive {
                    Failure::Capability
                } else {
                    Failure::Transient
                };
                self.negative(id, failure, now)
            };
            commands.extend(self.reply(id, result));
            commands.push(Command::Abort(ticket));
        }
        commands
    }
    pub fn deadline(&self) -> Option<u64> {
        self.jobs
            .values()
            .filter(|job| job.active && !job.owners.is_empty())
            .map(|job| job.deadline)
            .min()
    }
}
