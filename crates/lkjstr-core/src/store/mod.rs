//! In-memory event store: deduplicated, indexed, bounded. The browser layer
//! persists it to IndexedDB and reloads the newest slice at startup.

mod author_feed;
mod bytes;
pub use bytes::event_payload_bytes;
mod address;
mod context_pins;
mod directory;
mod expiration;
mod identity;
mod index;
mod profile;
mod query;
mod retention;
mod snapshot;

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
    replaceable: HashMap<(String, u64), String>,
    profiles: HashMap<String, Arc<Profile>>,
    verified_nip05: HashMap<String, String>,
    // At most 512 query name bindings; HTTP evidence is checked before insertion.
    query_names: HashMap<String, String>,
    deleted: HashSet<(String, String)>,
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
    evicted: BTreeMap<String, u64>,
    payload_bytes: usize,
    byte_cap: usize,
}

impl Store {
    /// Each class (regular and replaceable) retains at most `cap` events.
    pub fn new(cap: usize) -> Store {
        Self::with_caps(cap, cap)
    }

    /// Independent bounds prevent metadata from starving note retention.
    pub fn with_caps(cap: usize, replaceable_cap: usize) -> Store {
        Store {
            events: HashMap::new(),
            seen_on: HashMap::new(),
            by_time: BTreeSet::new(),
            by_author: HashMap::new(),
            by_tag_p: HashMap::new(),
            by_tag_e: HashMap::new(),
            replaceable: HashMap::new(),
            profiles: HashMap::new(),
            verified_nip05: HashMap::new(),
            query_names: HashMap::new(),
            deleted: HashSet::new(),
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

    /// Inserts a (verified) event seen on `relay`.
    pub fn insert(&mut self, event: NostrEvent, relay: Option<&str>) -> Inserted {
        if self.was_deleted(&event.id, &event.pubkey) {
            self.confirm_verified_deletion(&event.id);
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
        if event.kind == 5 {
            self.apply_deletion(&event);
        }
        if let Some(relay) = relay {
            self.note_relay(&event.id, relay);
        }
        if let Some(deadline) = deadline {
            self.expiry_deadlines.insert((deadline, event.id.clone()));
        }
        self.record_insert(&event);
        self.index(Arc::new(event));
        self.revision += 1;
        self.evict();
        outcome
    }
}
