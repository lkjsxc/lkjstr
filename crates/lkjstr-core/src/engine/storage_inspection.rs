//! One finite read per client, four overall. Closing/hiding revokes the lease;
//! old callbacks cannot settle a reused request. No storage effects live here.
#[path = "storage_inspection_types.rs"]
mod types;
use std::collections::{BTreeMap, BTreeSet};
pub use types::*;
struct Job {
    lease: Lease,
    memory: Memory,
    count: Option<Count>,
    origin: Option<Origin>,
    counting: bool,
    estimating: bool,
}
#[derive(Default)]
pub struct Book {
    next: u64,
    jobs: BTreeMap<u64, Job>,
    // Only attached clients may update visibility; the Host caps them at 32.
    hidden: BTreeSet<u64>,
}
impl Book {
    pub fn begin(
        &mut self,
        client: u64,
        req: &str,
        memory: Memory,
    ) -> Result<Option<Lease>, &'static str> {
        if req.is_empty() || req.len() > 256 || self.hidden.contains(&client) {
            return Err("rejected");
        }
        if let Some(job) = self.jobs.values().find(|job| job.lease.client == client) {
            return if job.lease.req == req {
                Ok(None)
            } else {
                Err("too-large")
            };
        }
        if self.jobs.len() >= MAX_JOBS {
            return Err("too-large");
        }
        if memory.events > MAX_SAFE
            || memory.event_payload_bytes > MAX_SAFE
            || memory.at > MAX_SAFE - DEADLINE_MS
        {
            return Err("internal");
        }
        self.next = self.next.checked_add(1).ok_or("internal")?;
        let lease = Lease {
            client,
            req: req.into(),
            token: self.next,
            deadline: memory.at + DEADLINE_MS,
        };
        self.jobs.insert(
            lease.token,
            Job {
                lease: lease.clone(),
                memory,
                count: None,
                origin: None,
                counting: false,
                estimating: false,
            },
        );
        Ok(Some(lease))
    }
    pub fn current(&self, lease: &Lease) -> bool {
        self.jobs
            .get(&lease.token)
            .is_some_and(|job| job.lease == *lease)
    }
    pub fn is_empty(&self) -> bool {
        self.jobs.is_empty()
    }
    pub fn leases(&self) -> Vec<Lease> {
        self.jobs.values().map(|job| job.lease.clone()).collect()
    }
    pub fn count_work(&mut self) -> Vec<Lease> {
        self.jobs
            .values_mut()
            .filter_map(|job| {
                if job.count.is_some() || job.counting {
                    return None;
                }
                job.counting = true;
                Some(job.lease.clone())
            })
            .collect()
    }
    pub fn origin_work(&mut self) -> Vec<Lease> {
        self.jobs
            .values_mut()
            .filter_map(|job| {
                if job.origin.is_some() || job.estimating {
                    return None;
                }
                job.estimating = true;
                Some(job.lease.clone())
            })
            .collect()
    }
    pub fn count(&mut self, lease: &Lease, value: Count, now: u64) -> Option<Reply> {
        if !self.current(lease) {
            return None;
        }
        let job = self.jobs.get_mut(&lease.token)?;
        if job.count.is_none() && now < lease.deadline && now >= job.memory.at && now <= MAX_SAFE {
            job.count = Some(value.checked(job.memory.at, now));
        }
        self.finish(lease.token, now)
    }
    pub fn origin(&mut self, lease: &Lease, value: Origin, now: u64) -> Option<Reply> {
        if !self.current(lease) {
            return None;
        }
        let job = self.jobs.get_mut(&lease.token)?;
        if job.origin.is_none() && now < lease.deadline && now >= job.memory.at && now <= MAX_SAFE {
            job.origin = Some(value.checked(job.memory.at, now));
        }
        self.finish(lease.token, now)
    }
    fn finish(&mut self, token: u64, now: u64) -> Option<Reply> {
        let job = self.jobs.get_mut(&token)?;
        if now < job.memory.at || now > MAX_SAFE {
            return None;
        }
        if now >= job.lease.deadline {
            job.count.get_or_insert(Count::Timeout);
            job.origin.get_or_insert(Origin::Timeout);
        }
        if job.count.is_none() || job.origin.is_none() {
            return None;
        }
        let job = self.jobs.remove(&token)?;
        Some(Reply {
            lease: job.lease,
            report: Report {
                started_at: job.memory.at,
                finished_at: now,
                memory: job.memory,
                persisted_events: job.count?,
                origin: job.origin?,
            },
        })
    }
    pub fn expire(&mut self, now: u64) -> Vec<Reply> {
        let tokens = self.jobs.keys().copied().collect::<Vec<_>>();
        tokens
            .into_iter()
            .filter_map(|token| self.finish(token, now))
            .collect()
    }
    pub fn close(&mut self, client: u64, req: &str) {
        self.jobs
            .retain(|_, job| job.lease.client != client || job.lease.req != req);
    }
    pub fn visible(&mut self, client: u64, visible: bool) {
        if visible {
            self.hidden.remove(&client);
        } else {
            if self.hidden.len() < 32 {
                self.hidden.insert(client);
            }
            self.jobs.retain(|_, job| job.lease.client != client);
        }
    }
    pub fn detach(&mut self, client: u64) {
        self.hidden.remove(&client);
        self.jobs.retain(|_, job| job.lease.client != client);
    }
    pub fn clear(&mut self) {
        self.jobs.clear();
        self.hidden.clear();
    }
}
