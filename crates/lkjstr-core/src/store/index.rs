//! Compact indexes share payload handles and preserve binary ID tie ordering.
use super::*;

impl Store {
    pub(super) fn note_relay(&mut self, id: Id, relay: &str) {
        let seen = self.seen_on.entry(id).or_default();
        if seen.len() < MAX_SEEN_RELAYS && !seen.iter().any(|r| r.as_str() == Some(relay)) {
            let before = seen.capacity();
            seen.push(self.compact.text(relay));
            self.seen_on_bytes += (seen.capacity() - before) * std::mem::size_of::<AtomRef>();
        }
    }

    /// Records that `relay` served a held event again; true when that is new. Bound: six relays per event.
    pub fn note_seen(&mut self, id: &str, relay: &str) -> bool {
        let Some(id) = decode_id(id).filter(|id| self.events.contains_key(id)) else {
            return false;
        };
        let before = self.seen_on.get(&id).map_or(0, Vec::len);
        self.note_relay(id, relay);
        self.seen_on.get(&id).map_or(0, Vec::len) > before
    }

    pub(super) fn index(&mut self, event: Lease) {
        self.payload_bytes += event.wire_bytes;
        let key = OrderedEvent(event.clone());
        self.by_time.insert(key.clone());
        self.by_author
            .entry(*event.pubkey())
            .or_default()
            .insert(key.clone());
        for author in event.tag_ids("p") {
            self.by_tag_p
                .entry(*author)
                .or_default()
                .insert(key.clone());
        }
        for target in event.tag_ids("e").chain(event.tag_ids("q")) {
            let list = self.by_tag_e.entry(*target).or_default();
            if !list.iter().any(|old| old.id() == event.id()) {
                list.push(event.clone());
            }
        }
        if event.kind == 1111 {
            for address in event.tag_values("a") {
                let list = self
                    .by_comment_address
                    .entry(address.into_owned())
                    .or_default();
                if !list.iter().any(|old| old.id() == event.id()) {
                    list.push(event.clone());
                }
            }
        }
        self.events.insert(*event.id(), event);
    }

    pub(super) fn remove(&mut self, id: &str) {
        let Some(binary) = decode_id(id) else { return };
        let Some(event) = self.events.remove(&binary) else {
            return;
        };
        if let Some(at) = event.expires_at {
            self.expiry_deadlines.remove(&(at, id.to_owned()));
        }
        self.generations.remove(&binary);
        self.access.remove(&binary);
        if let Some(d) = event.identifier() {
            self.addressable
                .remove(&(*event.pubkey(), event.kind, d.into_owned()));
        }
        self.snapshot_revision = self.revision;
        self.payload_bytes = self.payload_bytes.saturating_sub(event.wire_bytes);
        if is_replaceable_kind(event.kind) {
            self.replaceable.remove(&(*event.pubkey(), event.kind));
            if event.kind == 0 {
                self.profiles.remove(&event.pubkey_hex());
                self.verified_nip05.remove(&event.pubkey_hex());
            }
        }
        let key = OrderedEvent(event.clone());
        self.by_time.remove(&key);
        if let Some(set) = self.by_author.get_mut(event.pubkey()) {
            set.remove(&key);
        }
        if self
            .by_author
            .get(event.pubkey())
            .is_some_and(BTreeSet::is_empty)
        {
            self.by_author.remove(event.pubkey());
        }
        for pubkey in event.tag_ids("p") {
            if let Some(set) = self.by_tag_p.get_mut(pubkey) {
                set.remove(&key);
                if set.is_empty() {
                    self.by_tag_p.remove(pubkey);
                }
            }
        }
        for target in event.tag_ids("e").chain(event.tag_ids("q")) {
            if let Some(list) = self.by_tag_e.get_mut(target) {
                list.retain(|item| item.id() != &binary);
                if list.is_empty() {
                    self.by_tag_e.remove(target);
                }
            }
        }
        if event.kind == 1111 {
            for address in event.tag_values("a") {
                if let Some(list) = self.by_comment_address.get_mut(address.as_ref()) {
                    list.retain(|comment| comment.id() != &binary);
                    if list.is_empty() {
                        self.by_comment_address.remove(address.as_ref());
                    }
                }
            }
        }
        if let Some(seen) = self.seen_on.remove(&binary) {
            self.seen_on_bytes -= seen.capacity() * std::mem::size_of::<AtomRef>();
        }
    }
}
