use super::{Store, compact::CompactEvent, decode_id};
use crate::optimizer::link::{LinkState, cost_ms};
use lkjstr_protocol::{NostrEvent, is_addressable_kind};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn replaceable(kind: u64) -> bool {
    crate::optimizer::retention::replaceable(kind)
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

    pub(crate) fn durable_access(
        &self,
        minute: u64,
        own: BTreeSet<String>,
        mut held: BTreeSet<String>,
        weights: &BTreeMap<String, u64>,
        first_ms: &BTreeMap<String, u64>,
        link: LinkState,
    ) -> crate::cache::durable::Access {
        use crate::cache::durable::{Access, Observation};
        held.extend(self.context_pins.iter().cloned());
        let mut access = Access {
            minute,
            own,
            held,
            ..Default::default()
        };
        for event in self.events.values() {
            let id = event.id_hex();
            let author = event.pubkey_hex();
            let weight = weights.get(&id).copied().unwrap_or(1);
            let first = self
                .seen_on
                .get(event.id())
                .into_iter()
                .flatten()
                .filter_map(|url| url.as_str().and_then(|url| first_ms.get(url)).copied())
                .min()
                .unwrap_or(1500);
            let observation = Observation {
                minute: self.access.get(event.id()).minute,
                weight,
                refetch: first + cost_ms(link, event.wire_bytes as u64, 0, 0, 0),
            };
            access
                .authors
                .entry(author)
                .and_modify(|old| *old = (*old).max(weight))
                .or_insert(weight);
            access.events.insert(id, observation);
        }
        access
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
        if self.pressure.is_none() && !self.retention_needed() {
            return;
        }
        if !self.weighted {
            self.evict();
            return;
        }
        let mut epoch = self.pressure.take().unwrap_or_else(|| {
            self.compact.reap();
            self.pressure_start(weights, first_ms, link)
        });
        if epoch.scanning {
            self.pressure_scan(&mut epoch);
        }
        if !epoch.scanning {
            self.pressure_apply(&mut epoch, own, held);
        }
        if epoch.scanning || (!epoch.candidates.is_empty() && !epoch.target.satisfied(self.usage()))
        {
            self.pressure = Some(epoch);
        } else {
            self.compact.reap();
        }
        self.refresh_pressure();
    }

    pub(super) fn pin(
        &self,
        event: &CompactEvent,
        own: &BTreeSet<String>,
        held: &BTreeSet<String>,
        deletion_pins: &BTreeSet<String>,
    ) -> Option<&'static str> {
        if own.contains(&event.pubkey_hex()) && crate::optimizer::retention::own_policy(event.kind)
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
