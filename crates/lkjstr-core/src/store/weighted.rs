use super::{Store, compact::CompactEvent, decode_id};
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
        mut score: impl FnMut(u64, &str) -> u64,
    ) -> BTreeMap<String, u64> {
        self.events
            .values()
            .map(|event| (event.id_hex(), score(event.kind, &event.pubkey_hex())))
            .collect()
    }

    pub(crate) fn mark_read(&mut self, id: &str) {
        if self.weighted
            && let Some(binary) = decode_id(id)
            && self.events.contains_key(&binary)
        {
            self.access
                .record(&binary, self.now_seconds / 60, self.keep.inflation());
        }
    }

    pub fn ghost_hits(&self) -> u64 {
        self.ghost_hits
    }

    pub(crate) fn retention_needed(&self) -> bool {
        let addressable = self.addressable.len();
        let replaceable = self.replaceable.len() + addressable;
        self.managed_bytes() > self.byte_cap
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
        self.compact.reap();
        let deletion_pins = self.deletion_pins();
        let mut candidates: Vec<_> = self
            .events
            .values()
            .map(|event| {
                let bytes = event.resident_bytes()
                    + 3 * std::mem::size_of::<super::Id>()
                    + 8 * std::mem::size_of::<usize>()
                    + event.tag_values("p").count() * 6 * std::mem::size_of::<usize>()
                    + event.tag_values("e").chain(event.tag_values("q")).count()
                        * std::mem::size_of::<super::Lease>();
                let pin = self.pin(event, own, held, &deletion_pins);
                let weight = weights.get(&event.id_hex()).copied().unwrap_or(1);
                let first = self
                    .seen_on
                    .get(event.id())
                    .into_iter()
                    .flatten()
                    .filter_map(|url| url.as_str().and_then(|url| first_ms.get(url)).copied())
                    .min()
                    .unwrap_or(1500);
                let refetch = first + cost_ms(link, event.wire_bytes as u64, 0, 0, 0);
                let stamp = self.access.get(event.id());
                let minutes = (self.now_seconds / 60).saturating_sub(stamp.minute);
                let score =
                    self.keep
                        .score(stamp.inflation, event.kind, weight, minutes, refetch, bytes);
                Candidate {
                    pin,
                    score,
                    replaceable: replaceable(event.kind),
                    id: event.id_hex(),
                }
            })
            .collect();
        candidates.sort_unstable_by(|a, b| (a.score, &a.id).cmp(&(b.score, &b.id)));
        let mut regular = self.events.len() - self.replaceable.len() - self.addressable.len();
        let mut replaceable = self.replaceable.len() + self.addressable.len();
        let target = |count, cap| if count > cap { cap * 95 / 100 } else { cap };
        let reg_target = target(regular, self.cap);
        let rep_target = target(replaceable, self.replaceable_cap);
        let byte_target = target(self.managed_bytes(), self.byte_cap);
        let mut last = None;
        // Count pressure usually has ample byte headroom. It needs one accounting
        // pass after removals, not a whole-store recount for every scored candidate.
        for item in &candidates {
            let (count, limit) = if item.replaceable {
                (&mut replaceable, rep_target)
            } else {
                (&mut regular, reg_target)
            };
            if item.pin.is_none() && *count > limit {
                self.evict_one(&item.id);
                *count -= 1;
                last = Some(last.unwrap_or(0_u64).max(item.score));
            }
        }
        self.compact.reap();
        let mut charged = self.managed_bytes();
        for item in &candidates {
            if charged <= byte_target {
                break;
            }
            if item.pin.is_none() && self.lease(&item.id).is_some() {
                self.evict_one(&item.id);
                // Symbols are charged until this sweep actually releases them.
                self.compact.reap();
                charged = self.managed_bytes();
                last = Some(last.unwrap_or(0_u64).max(item.score));
            }
        }
        if let Some(score) = last {
            self.keep.advance(score);
        }
    }

    fn pin(
        &self,
        event: &CompactEvent,
        own: &BTreeSet<String>,
        held: &BTreeSet<String>,
        deletion_pins: &BTreeSet<String>,
    ) -> Option<&'static str> {
        if own.contains(&event.pubkey_hex())
            && matches!(event.kind, 0 | 3 | 10000 | 10002 | 10030 | 10063 | 30030)
        {
            return Some("own");
        }
        if deletion_pins.contains(&event.id_hex()) {
            return Some("deletion");
        }
        if self.context_pins.contains(&event.id_hex()) {
            return Some("context");
        }
        held.contains(&event.id_hex()).then_some("window")
    }
}
