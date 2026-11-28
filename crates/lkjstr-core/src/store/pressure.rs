//! A frozen resident epoch scans and applies at most WORK candidates per engine tick.
use super::{Store, compact::OrderKey, weighted};
use crate::optimizer::{
    link::{LinkState, cost_ms},
    retention::{Candidate, Candidates, Limits, Target, Usage, WORK},
};
use std::{
    collections::{BTreeMap, BTreeSet},
    ops::Bound,
};

pub const SCRATCH_BYTES: usize = 24 * 1024 * 1024;

pub(super) struct Epoch {
    pub candidates: Candidates,
    cursor: Option<OrderKey>,
    pub scanning: bool,
    revision: u64,
    minute: u64,
    stamps: super::access::Access,
    deletions: BTreeSet<String>,
    proof_revision: u64,
    weights: BTreeMap<String, u64>,
    first: BTreeMap<String, u64>,
    link: LinkState,
    pub target: Target,
}
impl Epoch {
    pub fn managed_bytes(&self) -> usize {
        self.candidates.managed_bytes()
            + self.stamps.managed_bytes()
            + self.weights.len() * 144
            + self.first.len() * 144
            + self
                .weights
                .keys()
                .chain(self.first.keys())
                .map(String::capacity)
                .sum::<usize>()
            + self.deletions.len() * 144
            + self.deletions.iter().map(String::capacity).sum::<usize>()
    }
}
impl Store {
    pub fn pressure_scratch_bytes(&self) -> usize {
        self.pressure.as_ref().map_or(0, Epoch::managed_bytes)
    }
    pub(crate) fn pressure_active(&self) -> bool {
        self.pressure.is_some()
    }
    pub(crate) fn pressure_admission_paused(&self) -> bool {
        let replaceable = self.replaceable.len() + self.addressable.len();
        self.weighted
            && (self.pressure_blocked
                || self.pressure.is_some()
                || replaceable > self.replaceable_cap
                || self.events.len() - replaceable > self.cap)
    }
    pub(crate) fn refresh_pressure(&mut self) -> bool {
        self.pressure_blocked = self.retention_needed();
        self.pressure_blocked
    }
    pub(super) fn usage(&self) -> Usage {
        let replaceable = self.replaceable.len() + self.addressable.len();
        Usage {
            regular: self.events.len() - replaceable,
            replaceable,
            bytes: self.managed_bytes(),
        }
    }
    pub(super) fn pressure_start(
        &self,
        weights: &BTreeMap<String, u64>,
        first: &BTreeMap<String, u64>,
        link: LinkState,
    ) -> Epoch {
        let used = self.usage();
        Epoch {
            candidates: Candidates::default(),
            cursor: None,
            scanning: true,
            revision: self.revision,
            minute: self.now_seconds / 60,
            stamps: self.access.clone(),
            deletions: self.deletion_pins(),
            proof_revision: self.snapshot_revision,
            weights: weights.clone(),
            first: first.clone(),
            link,
            target: Limits {
                regular: self.cap,
                replaceable: self.replaceable_cap,
                total: self.cap.saturating_add(self.replaceable_cap),
                bytes: self.byte_cap,
            }
            .target(used),
        }
    }
    pub(super) fn pressure_scan(&self, epoch: &mut Epoch) {
        let range = (
            epoch.cursor.map_or(Bound::Unbounded, Bound::Excluded),
            Bound::Unbounded,
        );
        let mut scanned = 0;
        for ordered in self.by_time.range::<OrderKey, _>(range).take(WORK) {
            let event = &ordered.0;
            epoch.cursor = Some(event.order);
            scanned += 1;
            let generation = self.generations.get(event.id()).copied().unwrap_or(0);
            if generation > epoch.revision {
                continue;
            }
            let bytes = event.resident_bytes()
                + 3 * std::mem::size_of::<super::Id>()
                + 8 * std::mem::size_of::<usize>()
                + event.tag_values("p").count() * 6 * std::mem::size_of::<usize>()
                + event.tag_values("e").chain(event.tag_values("q")).count()
                    * std::mem::size_of::<super::Lease>();
            let id = event.id_hex();
            let weight = epoch.weights.get(&id).copied().unwrap_or(1);
            let first = self
                .seen_on
                .get(event.id())
                .into_iter()
                .flatten()
                .filter_map(|url| url.as_str().and_then(|url| epoch.first.get(url)).copied())
                .min()
                .unwrap_or(1500);
            let refetch = first + cost_ms(epoch.link, event.wire_bytes as u64, 0, 0, 0);
            let stamp = epoch.stamps.get(event.id());
            let score = self.keep.score(
                stamp.inflation,
                event.kind,
                weight,
                epoch.minute.saturating_sub(stamp.minute),
                refetch,
                bytes,
            );
            epoch.candidates.push(Candidate {
                score,
                id,
                replaceable: weighted::replaceable(event.kind),
                generation,
                bytes,
            });
        }
        epoch.scanning = scanned == WORK;
        if epoch.managed_bytes() > SCRATCH_BYTES {
            // Preserve bodies and pause admission if the explicit scratch reserve
            // cannot represent this epoch. Never evict a partial candidate order.
            epoch.candidates = Candidates::default();
            epoch.scanning = false;
        }
    }
    pub(super) fn pressure_apply(
        &mut self,
        epoch: &mut Epoch,
        own: &BTreeSet<String>,
        held: &BTreeSet<String>,
    ) {
        if epoch.proof_revision != self.snapshot_revision {
            epoch.deletions = self.deletion_pins();
            epoch.proof_revision = self.snapshot_revision;
        }
        let mut used = self.usage();
        for _ in 0..WORK {
            if epoch.target.satisfied(used) {
                break;
            }
            let Some(candidate) = epoch.candidates.pop() else {
                break;
            };
            let Some(event) = self.lease(&candidate.id) else {
                continue;
            };
            if self.generations.get(event.id()).copied() != Some(candidate.generation)
                || self.pin(&event, own, held, &epoch.deletions).is_some()
                || !epoch.target.needs(used, candidate.replaceable)
            {
                continue;
            }
            if self.fetches.decisions_enabled()
                && crate::engine::fetch_records::ResourceClass::event(event.kind).is_some()
            {
                self.fetches.decision(
                    crate::engine::fetch_records::Action::Keep,
                    self.now_seconds.saturating_mul(1000),
                    std::iter::once(&candidate)
                        .chain(epoch.candidates.iter())
                        .filter(|c| {
                            self.lease(&c.id).is_some_and(|event| {
                                crate::engine::fetch_records::ResourceClass::event(event.kind)
                                    .is_some()
                            })
                        })
                        .map(|c| (c.id.as_str(), Some(c.score))),
                    std::iter::once(candidate.id.as_str()),
                );
            }
            drop(event);
            self.evict_one(&candidate.id);
            self.keep.advance(candidate.score);
            used.remove(candidate.replaceable, 0);
            if used.bytes > epoch.target.bytes {
                self.compact.reap();
                used.bytes = self.managed_bytes();
            }
        }
    }
}

#[cfg(test)]
#[path = "pressure_test.rs"]
mod tests;
