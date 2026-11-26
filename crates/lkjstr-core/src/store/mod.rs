//! Bounded event store hydrated from IndexedDB.

mod access;
mod accounting;
mod author_feed;
mod bytes;
pub mod compact;
mod insert;
pub use bytes::event_payload_bytes;
mod address;
mod context_pins;
mod deletion_addresses;
mod directory;
mod eviction_fences;
mod expiration;
mod identity;
mod index;
mod pressure;
mod profile;
mod query;
mod retention;
mod search;
mod snapshot;
mod weighted;

pub use profile::Profile;
pub use query::Query;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use lkjstr_protocol::{NostrEvent, is_replaceable_kind, tags::tag_values};

pub type Event = Arc<NostrEvent>;
use compact::{AtomRef, Id, Lease, OrderedEvent, Pool, decode_id};
type Key = (u64, String);

/// Relays an event was seen on, kept small: hints, not a log.
const MAX_SEEN_RELAYS: usize = 6;
/// At most this many (target id, deleting author) tombstones for late copies.
const MAX_DELETED: usize = 4096;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Inserted {
    New,
    Duplicate,
    Replaced,
    Stale,
    Deleted,
    Expired,
    InvalidExpiration,
    InvalidEncoding,
}

pub struct Store {
    events: HashMap<Id, Lease>,
    compact: Pool,
    seen_on: HashMap<Id, Vec<AtomRef>>,
    // Exact aggregate capacity of the relay-reference vectors, excluding atoms.
    seen_on_bytes: usize,
    by_time: BTreeSet<OrderedEvent>,
    by_author: HashMap<Id, BTreeSet<OrderedEvent>>,
    by_tag_p: HashMap<Id, BTreeSet<OrderedEvent>>,
    by_tag_e: HashMap<Id, Vec<Lease>>,
    by_comment_address: HashMap<String, Vec<Lease>>,
    replaceable: HashMap<(Id, u64), Id>,
    // One revision per retained addressable coordinate.
    addressable: HashMap<(Id, u64, String), Id>,
    profiles: HashMap<String, Arc<Profile>>,
    verified_nip05: HashMap<String, String>,
    // At most 512 query name bindings; HTTP evidence is checked before insertion.
    query_names: HashMap<String, String>,
    deleted: HashSet<(String, String)>,
    address_deletions: deletion_addresses::DeletionAddresses,
    context_pins: HashSet<String>,
    context_deleted: HashSet<(String, String)>,
    verified_deleted: HashMap<String, u64>,
    now_seconds: u64,
    // One deadline per retained public note or act with a valid NIP-40 tag.
    expiry_deadlines: BTreeSet<Key>,
    // At most MAX_DELETED checked expiry IDs, ordered by observation revision.
    expired: BTreeMap<String, (u64, String)>,
    expired_events: u64,
    invalid_expiration: u64,
    cap: usize,
    replaceable_cap: usize,
    revision: u64,
    // One generation per retained event; removed together with its event.
    generations: HashMap<Id, u64>,
    snapshot_revision: u64,
    history_removals: u64,
    evictions: u64,
    // At most MAX_DELETED recent evictions, with verified IDs only.
    evicted: BTreeMap<String, eviction_fences::Fence>,
    // Two orderings of the same bounded fence set, for removal and range repairs.
    evicted_order: BTreeSet<(u64, String)>,
    evicted_times: BTreeSet<Key>,
    ghost_hits: u64,
    weighted: bool,
    access: access::Access,
    keep: crate::optimizer::keep_policy::KeepScorer,
    payload_bytes: usize,
    byte_cap: usize,
    persistence_overhead: usize,
    pressure: Option<pressure::Epoch>,
    pressure_blocked: bool,
}

impl Store {
    pub fn new(cap: usize) -> Store {
        Self::with_caps(cap, cap)
    }

    pub fn with_caps(cap: usize, replaceable_cap: usize) -> Store {
        Store {
            events: HashMap::new(),
            compact: Pool::default(),
            seen_on: HashMap::new(),
            seen_on_bytes: 0,
            by_time: BTreeSet::new(),
            by_author: HashMap::new(),
            by_tag_p: HashMap::new(),
            by_tag_e: HashMap::new(),
            by_comment_address: HashMap::new(),
            replaceable: HashMap::new(),
            addressable: HashMap::new(),
            profiles: HashMap::new(),
            verified_nip05: HashMap::new(),
            query_names: HashMap::new(),
            deleted: HashSet::new(),
            address_deletions: Default::default(),
            context_pins: HashSet::new(),
            context_deleted: HashSet::new(),
            verified_deleted: HashMap::new(),
            now_seconds: 0,
            expiry_deadlines: BTreeSet::new(),
            expired: BTreeMap::new(),
            expired_events: 0,
            invalid_expiration: 0,
            cap,
            replaceable_cap,
            revision: 0,
            generations: HashMap::new(),
            snapshot_revision: 0,
            history_removals: 0,
            evictions: 0,
            evicted: BTreeMap::new(),
            evicted_order: BTreeSet::new(),
            evicted_times: BTreeSet::new(),
            ghost_hits: 0,
            weighted: false,
            access: Default::default(),
            keep: Default::default(),
            payload_bytes: 0,
            byte_cap: 64 * 1024 * 1024,
            persistence_overhead: 0,
            pressure: None,
            pressure_blocked: false,
        }
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn get(&self, id: &str) -> Option<Event> {
        self.lease(id).map(|event| event.materialize())
    }

    /// Immutable verified payload lease; survives removal from query indexes.
    pub fn lease(&self, id: &str) -> Option<Lease> {
        self.events.get(&decode_id(id)?).cloned()
    }

    /// Public metadata authors only; avoids expanding absent target follow graphs.
    pub fn metadata_authors(&self) -> BTreeSet<String> {
        self.events
            .values()
            .filter(|event| is_replaceable_kind(event.kind))
            .map(|event| event.pubkey_hex())
            .collect()
    }

    pub fn seen_on(&self, id: &str) -> Vec<String> {
        decode_id(id)
            .and_then(|id| self.seen_on.get(&id))
            .into_iter()
            .flatten()
            .map(|atom| atom.text().into_owned())
            .collect()
    }

    pub fn profile(&self, pubkey: &str) -> Option<Arc<Profile>> {
        self.profiles.get(pubkey).cloned()
    }

    pub fn replaceable(&self, pubkey: &str, kind: u64) -> Option<Event> {
        self.replaceable_lease(pubkey, kind)
            .map(|event| event.materialize())
    }

    pub(crate) fn replaceable_lease(&self, pubkey: &str, kind: u64) -> Option<&Lease> {
        let id = self.replaceable.get(&(decode_id(pubkey)?, kind))?;
        self.events.get(id)
    }
}

#[cfg(test)]
mod relay_accounting_test;
