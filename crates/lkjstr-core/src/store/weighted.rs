use super::{Store, event_payload_bytes};
use crate::optimizer::link::{LinkState, cost_ms};
use lkjstr_protocol::{NostrEvent, is_addressable_kind, is_replaceable_kind};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn replaceable(kind: u64) -> bool {
    is_replaceable_kind(kind) || is_addressable_kind(kind)
}

pub(super) fn identifier(event: &NostrEvent) -> Option<&str> {
    is_addressable_kind(event.kind).then(|| {
        event
            .tags
            .iter()
            .find(|tag| tag.first().is_some_and(|key| key == "d"))
            .and_then(|tag| tag.get(1))
            .map_or("", String::as_str)
    })
}

struct Candidate {
    pin: Option<&'static str>,
    score: u64,
    replaceable: bool,
    id: String,
}

impl Store {
    pub(crate) fn weight_retention(mut self) -> Self {
        self.weighted = true;
        self
    }

    pub(crate) fn retention_weights(
        &self,
        mut score: impl FnMut(&NostrEvent) -> u64,
    ) -> BTreeMap<String, u64> {
        self.events
            .values()
            .map(|event| (event.id.clone(), score(event)))
            .collect()
    }

    pub(crate) fn mark_read(&mut self, id: &str) {
        if self.weighted && self.events.contains_key(id) {
            self.access
                .record(id, self.now_seconds / 60, self.keep.inflation());
        }
    }

    pub fn ghost_hits(&self) -> u64 {
        self.ghost_hits
    }

    pub(crate) fn retention_needed(&self) -> bool {
        let addressable = self.addressable.len();
        let replaceable = self.replaceable.len() + addressable;
        self.payload_bytes > self.byte_cap
            || self.events.len() - replaceable > self.cap
            || replaceable > self.replaceable_cap
    }

    pub(crate) fn trim_weighted(
        &mut self,
        own: &BTreeSet<String>,
        held: &BTreeSet<String>,
        weights: &BTreeMap<String, u64>,
        first_ms: &BTreeMap<String, u64>,
        link: LinkState,
    ) {
        if !self.retention_needed() {
            return;
        }
        if !self.weighted {
            self.evict();
            return;
        }
        let deletion_pins = self.deletion_pins();
        let mut candidates: Vec<_> = self
            .events
            .values()
            .map(|event| {
                let bytes = event_payload_bytes(event);
                let pin = self.pin(event, own, held, &deletion_pins);
                let weight = weights.get(&event.id).copied().unwrap_or(1);
                let first = self
                    .seen_on(&event.id)
                    .iter()
                    .filter_map(|url| first_ms.get(url).copied())
                    .min()
                    .unwrap_or(1500);
                let refetch = first + cost_ms(link, bytes as u64, 0, 0, 0);
                let stamp = self.access.get(&event.id);
                let minutes = (self.now_seconds / 60).saturating_sub(stamp.minute);
                let score =
                    self.keep
                        .score(stamp.inflation, event.kind, weight, minutes, refetch, bytes);
                Candidate {
                    pin,
                    score,
                    replaceable: replaceable(event.kind),
                    id: event.id.clone(),
                }
            })
            .collect();
        candidates.sort_unstable_by(|a, b| (a.score, &a.id).cmp(&(b.score, &b.id)));
        let mut regular = self.events.len() - self.replaceable.len() - self.addressable.len();
        let mut replaceable = self.replaceable.len() + self.addressable.len();
        let target = |count, cap| if count > cap { cap * 95 / 100 } else { cap };
        let reg_target = target(regular, self.cap);
        let rep_target = target(replaceable, self.replaceable_cap);
        let byte_target = target(self.payload_bytes, self.byte_cap);
        let mut last = None;
        for item in &candidates {
            let (count, limit) = if item.replaceable {
                (&mut replaceable, rep_target)
            } else {
                (&mut regular, reg_target)
            };
            if item.pin.is_none() && (*count > limit || self.payload_bytes > byte_target) {
                self.evict_one(&item.id);
                *count -= 1;
                last = Some(item.score);
            }
        }
        if let Some(score) = last {
            self.keep.advance(score);
        }
    }

    fn pin(
        &self,
        event: &NostrEvent,
        own: &BTreeSet<String>,
        held: &BTreeSet<String>,
        deletion_pins: &BTreeSet<&str>,
    ) -> Option<&'static str> {
        if own.contains(&event.pubkey)
            && matches!(event.kind, 0 | 3 | 10000 | 10002 | 10030 | 10063 | 30030)
        {
            return Some("own");
        }
        if deletion_pins.contains(event.id.as_str()) {
            return Some("deletion");
        }
        if self.context_pins.contains(&event.id) {
            return Some("context");
        }
        held.contains(&event.id).then_some("window")
    }
}
