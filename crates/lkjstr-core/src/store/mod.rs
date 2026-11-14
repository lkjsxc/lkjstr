//! In-memory event store: deduplicated, indexed, bounded. The browser layer
//! persists it to IndexedDB and reloads the newest slice at startup.

mod directory;
mod profile;
mod query;

pub use profile::Profile;
pub use query::Query;

use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use lkjstr_protocol::{NostrEvent, is_replaceable_kind, tags::tag_values};

pub type Event = Arc<NostrEvent>;
type Key = (u64, String);

/// Relays an event was seen on, kept small: hints, not a log.
const MAX_SEEN_RELAYS: usize = 6;
/// Ids remembered as deleted (kind 5) so late copies stay hidden.
const MAX_DELETED: usize = 4096;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Inserted {
    New,
    Duplicate,
    Replaced,
    Stale,
    Deleted,
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
    deleted: HashSet<String>,
    cap: usize,
    revision: u64,
}

impl Store {
    /// `cap` bounds non-replaceable events; the oldest are evicted first.
    pub fn new(cap: usize) -> Store {
        Store {
            events: HashMap::new(),
            seen_on: HashMap::new(),
            by_time: BTreeSet::new(),
            by_author: HashMap::new(),
            by_tag_p: HashMap::new(),
            by_tag_e: HashMap::new(),
            replaceable: HashMap::new(),
            profiles: HashMap::new(),
            deleted: HashSet::new(),
            cap,
            revision: 0,
        }
    }

    /// Increases on every visible change; views re-query when it moves.
    pub fn revision(&self) -> u64 {
        self.revision
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
        if let Some(relay) = relay {
            self.note_relay(&event.id, relay);
        }
        if self.deleted.contains(&event.id) {
            return Inserted::Deleted;
        }
        if self.events.contains_key(&event.id) {
            return Inserted::Duplicate;
        }
        let mut outcome = Inserted::New;
        if is_replaceable_kind(event.kind) {
            let slot = (event.pubkey.clone(), event.kind);
            if let Some(old) = self.replaceable.get(&slot).and_then(|id| self.get(id)) {
                if (old.created_at, &old.id) >= (event.created_at, &event.id) {
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
        self.index(Arc::new(event));
        self.revision += 1;
        self.evict();
        outcome
    }

    fn note_relay(&mut self, id: &str, relay: &str) {
        let seen = self.seen_on.entry(id.to_owned()).or_default();
        if seen.len() < MAX_SEEN_RELAYS && !seen.iter().any(|r| r == relay) {
            seen.push(relay.to_owned());
        }
    }

    fn index(&mut self, event: Event) {
        let key = (event.created_at, event.id.clone());
        self.by_time.insert(key.clone());
        self.by_author
            .entry(event.pubkey.clone())
            .or_default()
            .insert(key.clone());
        for pubkey in tag_values(&event, "p") {
            self.by_tag_p.entry(pubkey).or_default().insert(key.clone());
        }
        for target in tag_values(&event, "e")
            .into_iter()
            .chain(tag_values(&event, "q"))
        {
            let list = self.by_tag_e.entry(target).or_default();
            if !list.contains(&event.id) {
                list.push(event.id.clone());
            }
        }
        self.events.insert(event.id.clone(), event);
    }

    fn remove(&mut self, id: &str) {
        let Some(event) = self.events.remove(id) else {
            return;
        };
        let key = (event.created_at, event.id.clone());
        self.by_time.remove(&key);
        if let Some(set) = self.by_author.get_mut(&event.pubkey) {
            set.remove(&key);
        }
        if self
            .by_author
            .get(&event.pubkey)
            .is_some_and(BTreeSet::is_empty)
        {
            self.by_author.remove(&event.pubkey);
        }
        for pubkey in tag_values(&event, "p") {
            if let Some(set) = self.by_tag_p.get_mut(&pubkey) {
                set.remove(&key);
                if set.is_empty() {
                    self.by_tag_p.remove(&pubkey);
                }
            }
        }
        for target in tag_values(&event, "e")
            .into_iter()
            .chain(tag_values(&event, "q"))
        {
            if let Some(list) = self.by_tag_e.get_mut(&target) {
                list.retain(|item| item != id);
                if list.is_empty() {
                    self.by_tag_e.remove(&target);
                }
            }
        }
        self.seen_on.remove(id);
    }

    fn apply_deletion(&mut self, deletion: &NostrEvent) {
        for target in tag_values(deletion, "e") {
            let owned = self
                .events
                .get(&target)
                .is_none_or(|event| event.pubkey == deletion.pubkey);
            if owned && self.deleted.len() < MAX_DELETED {
                self.remove(&target);
                self.deleted.insert(target);
            }
        }
    }

    fn evict(&mut self) {
        while self.events.len() > self.cap {
            let victim = self.by_time.iter().find_map(|(_, id)| {
                let event = self.events.get(id)?;
                (!is_replaceable_kind(event.kind)).then(|| id.clone())
            });
            match victim {
                Some(id) => self.remove(&id),
                None => break,
            }
        }
    }
}
