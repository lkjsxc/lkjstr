//! Durable GDSF uses the resident planner, with serialized row costs and its own clock.
use super::{Record, Restored};
use crate::optimizer::retention::{self, Candidate, Candidates, Limits, Target, Usage};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[path = "cache_durable_authority.rs"]
mod authority;
#[path = "cache_durable_score.rs"]
mod scoring;

pub const KEY: &str = "durable-gdsf-v1";
pub const LIMITS: Limits = Limits {
    regular: 20_000,
    replaceable: 20_000,
    total: 20_000,
    bytes: 64 * 1024 * 1024,
};
#[derive(Clone, Default)]
pub struct Access {
    pub minute: u64,
    pub own: BTreeSet<String>,
    pub held: BTreeSet<String>,
    pub authors: BTreeMap<String, u64>,
    pub events: BTreeMap<String, Observation>,
}
#[derive(Clone, Copy, Default, Serialize, Deserialize)]
pub struct Observation {
    pub minute: u64,
    pub weight: u64,
    pub refetch: u64,
}
#[derive(Clone, Copy, Default, Serialize, Deserialize)]
pub struct Hint {
    pub observation: Observation,
    pub inflation: u64,
}
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct State {
    pub generation: u64,
    pub inflation: u64,
    pub used: Usage,
    pub dirty_bytes: usize,
    pub initialized: bool,
    pub epoch: Option<(u64, u64, Target)>,
}
impl State {
    pub fn read(raw: Option<&str>) -> Self {
        raw.and_then(|raw| serde_json::from_str(raw).ok())
            .unwrap_or_default()
    }
    pub fn changed(&mut self, bytes: usize) {
        self.generation = self.generation.saturating_add(1);
        self.dirty_bytes = self.dirty_bytes.saturating_add(bytes);
        self.epoch = None;
    }
    pub fn needed(&self, count: usize) -> bool {
        !self.initialized
            || self.epoch.is_some()
            || count > LIMITS.total
            || self.used.bytes.saturating_add(self.dirty_bytes) > LIMITS.bytes
    }
}
/// UTF-8 record bytes plus a conservative fixed reservation for key/time indexes.
/// This is an application charge, not a browser storage-usage measurement.
pub fn charge(row: &Record) -> usize {
    row.raw
        .len()
        .saturating_add(row.id.len())
        .saturating_add(row.receipt.as_ref().map_or(0, String::len))
        .saturating_add(256)
}
pub struct Scan {
    pub used: Usage,
    candidates: Candidates,
    ranked: Candidates,
    sealed: bool,
    reweighted: bool,
    scores: BTreeMap<String, scoring::Header>,
    pub protected: BTreeSet<String>,
    pub required: BTreeSet<String>,
    deletions: BTreeSet<(String, String)>,
    addresses: BTreeMap<String, u64>,
    versions: BTreeMap<String, (u64, String, bool)>,
    superseded: BTreeSet<String>,
    deleted: BTreeSet<String>,
    pub access: Access,
    pub state: State,
}
impl Scan {
    pub fn push(&mut self, row: &Record, hint: Hint) {
        let bytes = charge(row);
        self.used.bytes = self.used.bytes.saturating_add(bytes);
        let replaceable = row.kind.is_some_and(retention::replaceable);
        if replaceable {
            self.used.replaceable += 1;
        } else {
            self.used.regular += 1;
        }
        let mut score = 0;
        if let Ok(Restored::Verified(event)) = row.restore() {
            self.version(&event);
            let now = self.state.epoch.map_or(self.access.minute, |epoch| epoch.0);
            let mut hint = hint;
            if let Some(observation) = self.access.events.get(&event.id)
                && observation.minute >= hint.observation.minute
            {
                hint = Hint {
                    observation: *observation,
                    inflation: self
                        .state
                        .epoch
                        .map_or(self.state.inflation, |epoch| epoch.1),
                };
            }
            let coordinate = retention::replaceable(event.kind).then(|| {
                let d = if lkjstr_protocol::is_addressable_kind(event.kind) {
                    lkjstr_protocol::tags::tag_values(&event, "d")
                        .into_iter()
                        .next()
                        .unwrap_or_default()
                } else {
                    String::new()
                };
                format!("{}:{}:{}", event.kind, event.pubkey, d)
            });
            let deleted = event.kind != 5
                && (self
                    .deletions
                    .contains(&(event.id.clone(), event.pubkey.clone()))
                    || coordinate.is_some_and(|key| {
                        self.addresses
                            .get(&key)
                            .is_some_and(|at| *at >= event.created_at)
                    }));
            if deleted {
                self.deleted.insert(event.id.clone());
            }
            let header = scoring::Header {
                author: event.pubkey,
                kind: event.kind,
                hint,
            };
            if !deleted {
                score = header.score(&self.access.authors, now, bytes);
            }
            self.scores.insert(row.id.clone(), header);
        }

        self.candidates.push(Candidate {
            score,
            id: row.id.clone(),
            replaceable,
            generation: self.state.generation,
            bytes,
        });
    }
    fn seal(&mut self, limit: usize) -> bool {
        if self.sealed {
            return true;
        }
        if !self.reweighted && self.superseded.is_empty() && self.deleted.is_empty() {
            self.sealed = true;
            return true;
        }
        for _ in 0..limit {
            let Some(mut candidate) = self.candidates.pop() else {
                std::mem::swap(&mut self.candidates, &mut self.ranked);
                self.sealed = true;
                return true;
            };
            if self.deleted.contains(&candidate.id) || self.superseded.contains(&candidate.id) {
                candidate.score = 0;
            } else if let Some(header) = self.scores.get(&candidate.id) {
                let now = self.state.epoch.map_or(self.access.minute, |epoch| epoch.0);
                candidate.score = header.score(&self.access.authors, now, candidate.bytes);
            }
            self.ranked.push(candidate);
        }
        false
    }
    pub fn victims(&mut self, limit: usize, held: &BTreeSet<String>) -> Vec<Candidate> {
        self.protected.extend(
            self.versions
                .values()
                .filter(|(_, id, own)| *own && !self.deleted.contains(id))
                .map(|(_, id, _)| id.clone()),
        );
        let target = self
            .state
            .epoch
            .map_or_else(|| LIMITS.target(self.used), |epoch| epoch.2);
        let base = self
            .state
            .epoch
            .map_or(self.state.inflation, |epoch| epoch.1);
        let mut victims = Vec::new();
        let sealed = self.seal(limit);
        for _ in 0..if sealed { limit } else { 0 } {
            if target.satisfied(self.used) {
                break;
            }
            let Some(candidate) = self.candidates.pop() else {
                break;
            };
            let obsolete =
                self.deleted.contains(&candidate.id) || self.superseded.contains(&candidate.id);
            if self.required.contains(&candidate.id)
                || (!obsolete
                    && (self.protected.contains(&candidate.id) || held.contains(&candidate.id)))
                || !target.needs(self.used, candidate.replaceable)
            {
                continue;
            }
            self.used.remove(candidate.replaceable, candidate.bytes);
            self.state.inflation = self.state.inflation.max(candidate.score);
            victims.push(candidate);
        }
        self.state.used = self.used;
        self.state.initialized = true;
        self.state.dirty_bytes = 0;
        self.state.epoch = (!target.satisfied(self.used)
            && (LIMITS.exceeded(self.used) || !self.exhausted()))
        .then_some((
            self.state.epoch.map_or(self.access.minute, |epoch| epoch.0),
            base,
            target,
        ));
        victims
    }
    pub fn exhausted(&self) -> bool {
        self.sealed && self.candidates.is_empty()
    }
}
