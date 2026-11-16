//! Bounded, account-scoped private-list reads. This policy performs no I/O.
use crate::store::Store;
use lkjstr_nips::list_read::Format;
use std::collections::{BTreeMap, BTreeSet};
mod demand;
mod finish;
mod lifecycle;
mod policy;
mod schedule;
mod types;
pub use demand::events;
pub use types::{Access, Demand, Job, MAX_BYTES, MAX_RECORDS, Status};
use types::{Phase, Record};
#[derive(Default)]
pub struct Reads {
    records: BTreeMap<String, Record>,
    access: BTreeMap<String, (Access, u64)>,
    wants: Vec<Demand>,
    failures: BTreeMap<String, &'static str>,
    unsupported: BTreeSet<(String, Format)>,
    next: u64,
    last_account: String,
    pub revision: u64,
}
impl Reads {
    fn serial(&mut self) -> Option<u64> {
        self.next = self.next.checked_add(1)?;
        Some(self.next)
    }
    fn changed(&mut self) {
        self.revision = self.revision.wrapping_add(1);
    }
    pub fn len(&self) -> usize {
        self.records.len()
    }
    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }
    pub fn bytes(&self) -> usize {
        self.records.values().map(|r| r.bytes).sum()
    }
    pub fn active(&self) -> Vec<Job> {
        self.records
            .values()
            .filter_map(|record| match &record.phase {
                Phase::Running(job) => Some(job.clone()),
                _ => None,
            })
            .collect()
    }
    pub fn current(&self, job: &Job, now: u64) -> bool {
        now < job.deadline
            && self
                .records
                .get(&job.event)
                .is_some_and(|r| matches!(&r.phase, Phase::Running(current) if current == job))
            && self
                .access
                .get(&job.account)
                .is_some_and(|(a, e)| a.error.is_none() && *e == job.epoch)
            && self.wants.iter().any(|d| {
                d.client == job.client
                    && d.sub == job.sub
                    && d.account == job.account
                    && d.events.contains(&job.event)
            })
    }
    pub fn retry(&mut self, account: &str) {
        self.failures.remove(account);
        self.unsupported.retain(|(a, _)| a != account);
        self.records.retain(|_, r| {
            r.account != account || r.format.is_some() || matches!(r.phase, Phase::Ready)
        });
        for record in self.records.values_mut().filter(|r| r.account == account) {
            if matches!(record.phase, Phase::Failed(_)) {
                record.phase = Phase::Pending;
            }
        }
        self.changed();
    }
    pub fn status(&self, account: &str, events: &[String]) -> Status {
        let mut status = Status::default();
        for id in events {
            let record = self.records.get(id).filter(|r| r.account == account);
            if record.is_some_and(|r| matches!(r.phase, Phase::Ready)) {
                continue;
            }
            let error = self
                .access
                .get(account)
                .map_or(Some("signer-missing"), |(a, _)| a.error)
                .or_else(|| self.failures.get(account).copied())
                .or_else(|| {
                    record.and_then(|r| r.format).and_then(|f| {
                        self.unsupported
                            .contains(&(account.into(), f))
                            .then_some("unsupported")
                    })
                });
            let error = error.or_else(|| match record.map(|r| &r.phase) {
                Some(Phase::Failed(code)) => Some(*code),
                None if self.records.len() >= MAX_RECORDS => Some("too-large"),
                _ => None,
            });
            if let Some(code) = error {
                status.failed += 1;
                if status.error.is_none() {
                    status.error = Some(code);
                }
            } else if !record.is_some_and(|r| matches!(r.phase, Phase::Ready)) {
                status.pending += 1;
            }
        }
        status.phase = if status.failed > 0 {
            if status.error == Some("unsupported") {
                "unsupported"
            } else {
                "failed"
            }
        } else if status.pending > 0 {
            "loading"
        } else {
            "ready"
        };
        status
    }
}
fn current(store: &Store, id: &str) -> bool {
    let Some(event) = store.get(id) else {
        return false;
    };
    if event.kind == 30000 {
        let Some(tag) = event
            .tags
            .iter()
            .find(|t| t.first().is_some_and(|v| v == "d"))
            .and_then(|t| t.get(1))
        else {
            return false;
        };
        let query = super::protocol::Query {
            source: super::protocol::Source::List,
            account: Some(event.pubkey.clone()),
            target: Some(format!("30000:{}:{tag}", event.pubkey)),
            ..Default::default()
        };
        super::query::events(store, &query)
            .first()
            .is_some_and(|e| e.id == id)
    } else {
        store
            .replaceable(&event.pubkey, event.kind)
            .is_some_and(|e| e.id == id)
    }
}
