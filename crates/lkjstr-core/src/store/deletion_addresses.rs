//! Bounded NIP-09 address cutoffs survive removal of the deleting event.
use super::{Event, MAX_DELETED, Store, weighted::identifier};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrEvent, compare_events_desc, tags::tag_values};
use std::collections::{BTreeMap, BTreeSet};

type Address = (String, u64, String);

#[derive(Default)]
pub(super) struct DeletionAddresses {
    // At most MAX_DELETED verified author-bound coordinates.
    cutoffs: BTreeMap<Address, u64>,
}

fn key(event: &NostrEvent) -> Address {
    (
        event.pubkey.clone(),
        event.kind,
        identifier(event).unwrap_or("").to_owned(),
    )
}

impl DeletionAddresses {
    pub(super) fn managed_bytes(&self) -> usize {
        if self.cutoffs.is_empty() {
            return 11 * std::mem::size_of::<(Address, u64)>() + 16;
        }
        (self.cutoffs.len().div_ceil(5) + 1)
            * (11 * std::mem::size_of::<(Address, u64)>() + 12 * std::mem::size_of::<usize>() + 16)
            + self
                .cutoffs
                .keys()
                .map(|(author, _, d)| author.capacity() + d.capacity())
                .sum::<usize>()
    }
    pub fn covers(&self, event: &NostrEvent) -> bool {
        super::weighted::replaceable(event.kind)
            && self
                .cutoffs
                .get(&key(event))
                .is_some_and(|cutoff| *cutoff >= event.created_at)
    }

    pub fn holds(&self, deletion: &NostrEvent, address: &Coordinate) -> bool {
        address.pubkey == deletion.pubkey
            && self.cutoffs.contains_key(&(
                address.pubkey.clone(),
                address.kind.into(),
                address.identifier.clone(),
            ))
    }
}

impl Store {
    pub(super) fn apply_address_deletion(&mut self, deletion: &NostrEvent) {
        for address in tag_values(deletion, "a")
            .iter()
            .filter_map(|raw| Coordinate::parse(raw).ok())
        {
            if address.pubkey != deletion.pubkey {
                continue;
            }
            let target = self
                .addressed(&address)
                .filter(|event| event.created_at <= deletion.created_at);
            let coordinate = (address.pubkey, address.kind.into(), address.identifier);
            let cutoffs = &mut self.address_deletions.cutoffs;
            if cutoffs.len() < MAX_DELETED || cutoffs.contains_key(&coordinate) {
                let cutoff = cutoffs.entry(coordinate).or_default();
                *cutoff = (*cutoff).max(deletion.created_at);
            }
            if let Some(target) = target {
                self.apply_verified_deletion(&target.id);
            }
        }
    }

    /// Keep one signed witness per held or fenced target. Redundant copies
    /// cannot consume the entire retention floor.
    pub(super) fn deletion_pins(&self) -> BTreeSet<String> {
        let mut witnesses: BTreeMap<(String, String, String), Event> = BTreeMap::new();
        for event in self
            .events
            .values()
            .filter(|event| event.kind == 5)
            .map(|event| event.materialize())
        {
            for tag in &event.tags {
                let [kind, target, ..] = tag.as_slice() else {
                    continue;
                };
                let protected = match kind.as_str() {
                    "e" => {
                        self.lease(target)
                            .is_some_and(|e| e.pubkey_hex() == event.pubkey)
                            || self
                                .evicted
                                .get(target)
                                .is_some_and(|fence| fence.author == event.pubkey)
                            || self
                                .deleted
                                .contains(&(target.clone(), event.pubkey.clone()))
                    }
                    "a" => Coordinate::parse(target)
                        .is_ok_and(|address| self.address_deletions.holds(&event, &address)),
                    _ => false,
                };
                if protected {
                    let current = witnesses
                        .entry((kind.clone(), target.clone(), event.pubkey.clone()))
                        .or_insert_with(|| event.clone());
                    if compare_events_desc(&event, current).is_lt() {
                        *current = event.clone();
                    }
                }
            }
        }
        witnesses
            .into_values()
            .map(|event| event.id.clone())
            .collect()
    }

    pub(super) fn apply_verified_deletion(&mut self, id: &str) {
        self.confirm_verified_deletion(id);
        self.resolve_eviction(id, false);
        self.remove(id);
    }
}
