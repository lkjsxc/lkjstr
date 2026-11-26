//! Bounded NIP-09 address cutoffs survive removal of the deleting event.
use super::{MAX_DELETED, Store, weighted::identifier};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrEvent, tags::tag_values};
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

    /// Unknown targets still have possible author-bound authority after the
    /// bounded tombstone indexes fill. Keep one sufficient witness per target.
    pub(super) fn deletion_pins(&self) -> BTreeSet<String> {
        let mut witnesses: BTreeMap<(String, String, String), &super::Lease> = BTreeMap::new();
        for event in self.events.values().filter(|event| event.kind == 5) {
            let author = event.pubkey_hex();
            for kind in ["e", "a"] {
                for target in event.tag_values(kind) {
                    let key = match kind {
                        "e" if lkjstr_protocol::is_event_id(&target)
                            && self.lease(&target).is_none_or(|body| {
                                body.kind != 5 && body.pubkey_hex() == author
                            }) =>
                        {
                            target.into_owned()
                        }
                        "a" => {
                            let Ok(address) = Coordinate::parse(&target) else {
                                continue;
                            };
                            if address.pubkey != author {
                                continue;
                            }
                            address.to_string()
                        }
                        _ => continue,
                    };
                    let witness = witnesses
                        .entry((kind.into(), key, author.clone()))
                        .or_insert(event);
                    if event.order > witness.order {
                        *witness = event;
                    }
                }
            }
        }
        witnesses
            .into_values()
            .map(|event| event.id_hex())
            .collect()
    }

    pub(super) fn address_was_deleted(&self, event: &NostrEvent) -> bool {
        if self.address_deletions.covers(event) {
            return true;
        }
        if self.address_deletions.cutoffs.len() < MAX_DELETED
            || !super::weighted::replaceable(event.kind)
        {
            return false;
        }
        let Some(author) = super::decode_id(&event.pubkey) else {
            return false;
        };
        let coordinate = format!(
            "{}:{}:{}",
            event.kind,
            event.pubkey,
            identifier(event).unwrap_or("")
        );
        self.by_author
            .get(&author)
            .into_iter()
            .flatten()
            .any(|ordered| {
                let deletion = &ordered.0;
                deletion.kind == 5
                    && deletion.order.0 >= event.created_at
                    && deletion.tag_values("a").any(|raw| {
                        Coordinate::parse(&raw).is_ok_and(|address| {
                            address.pubkey == event.pubkey && address.to_string() == coordinate
                        })
                    })
            })
    }

    pub(super) fn apply_verified_deletion(&mut self, id: &str) {
        // NIP-09 deletion of a deletion request has no effect.
        if self.lease(id).is_some_and(|event| event.kind == 5) {
            return;
        }
        self.confirm_verified_deletion(id);
        self.resolve_eviction(id, false);
        self.remove(id);
    }
}
