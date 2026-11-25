//! Bounded event store hydrated from IndexedDB.

mod access;
mod author_feed;
mod bytes;
pub use bytes::event_payload_bytes;
mod address;
mod context_pins;
mod deletion_addresses;
mod directory;
mod eviction_fences;
mod expiration;
mod identity;
mod index;
mod profile;
mod query;
mod retention;
mod snapshot;
mod weighted;

pub use profile::Profile;
pub use query::Query;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use lkjstr_protocol::{NostrEvent, is_replaceable_kind, tags::tag_values};

pub type Event = Arc<NostrEvent>;
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
}

pub struct Store {
    events: HashMap<String, Event>,
    seen_on: HashMap<String, Vec<String>>,
    by_time: BTreeSet<Key>,
    by_author: HashMap<String, BTreeSet<Key>>,
    by_tag_p: HashMap<String, BTreeSet<Key>>,
    by_tag_e: HashMap<String, Vec<String>>,
    by_comment_address: HashMap<String, Vec<String>>,
    replaceable: HashMap<(String, u64), String>,
    // One revision per retained addressable coordinate.
    addressable: HashMap<(String, u64, String), String>,
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
    generations: HashMap<String, u64>,
    snapshot_revision: u64,
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
}

impl Store {
    pub fn new(cap: usize) -> Store {
        Self::with_caps(cap, cap)
    }

    pub fn with_caps(cap: usize, replaceable_cap: usize) -> Store {
        Store {
            events: HashMap::new(),
            seen_on: HashMap::new(),
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
        }
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn get(&self, id: &str) -> Option<Event> {
        self.events.get(id).cloned()
    }

    pub fn seen_on(&self, id: &str) -> &[String] {
        self.seen_on.get(id).map_or(&[], Vec::as_slice)
    }

    pub fn profile(&self, pubkey: &str) -> Option<Arc<Profile>> {
        self.profiles.get(pubkey).cloned()
    }

    pub fn replaceable(&self, pubkey: &str, kind: u64) -> Option<Event> {
        let id = self.replaceable.get(&(pubkey.to_owned(), kind))?;
        self.get(id)
    }

    pub fn insert(&mut self, event: NostrEvent, relay: Option<&str>) -> Inserted {
        self.insert_inner(event, relay, false)
    }

    pub(crate) fn insert_deferred(&mut self, event: NostrEvent, relay: Option<&str>) -> Inserted {
        self.insert_inner(event, relay, self.weighted)
    }

    fn insert_inner(&mut self, event: NostrEvent, relay: Option<&str>, deferred: bool) -> Inserted {
        if self.was_deleted(&event.id, &event.pubkey) || self.address_deletions.covers(&event) {
            self.apply_verified_deletion(&event.id);
            return Inserted::Deleted;
        }
        if self.events.contains_key(&event.id) {
            if let Some(relay) = relay {
                self.note_relay(&event.id, relay);
            }
            return Inserted::Duplicate;
        }
        let deadline = match expiration::deadline(&event) {
            Ok(Some(at)) if at <= self.now_seconds => {
                self.resolve_eviction(&event.id, false);
                self.record_expiration(&event.id, &event.pubkey);
                return Inserted::Expired;
            }
            Ok(at) => at,
            Err(_) => {
                self.invalid_expiration = self.invalid_expiration.saturating_add(1);
                return Inserted::InvalidExpiration;
            }
        };
        let mut outcome = Inserted::New;
        if is_replaceable_kind(event.kind) {
            let slot = (event.pubkey.clone(), event.kind);
            if let Some(old) = self.replaceable.get(&slot).and_then(|id| self.get(id)) {
                if old.created_at > event.created_at
                    || (old.created_at == event.created_at && old.id < event.id)
                {
                    return Inserted::Stale;
                }
                self.remove(&old.id);
                outcome = Inserted::Replaced;
            }
            self.replaceable.insert(slot, event.id.clone());
            if event.kind == 0 {
                let profile = Profile::parse(&event.content);
                self.profiles
                    .insert(event.pubkey.clone(), Arc::new(profile));
            }
        }
        if let Some(replaced) = self.replace_address(&event) {
            match replaced {
                Inserted::Stale => return Inserted::Stale,
                _ => outcome = replaced,
            }
        }
        if event.kind == 5 {
            self.apply_deletion(&event);
        }
        if let Some(relay) = relay {
            self.note_relay(&event.id, relay);
        }
        if let Some(deadline) = deadline {
            self.expiry_deadlines.insert((deadline, event.id.clone()));
        }
        self.resolve_eviction(&event.id, relay.is_some_and(|url| url.starts_with("ws")));
        self.access
            .record(&event.id, self.now_seconds / 60, self.keep.inflation());
        self.record_insert(&event);
        self.index(Arc::new(event));
        self.revision += 1;
        if !deferred {
            self.evict();
        }
        outcome
    }
}
