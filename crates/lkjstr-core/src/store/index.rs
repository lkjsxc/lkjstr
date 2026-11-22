//! Keep the event indexes and the retained payload bound in sync.
use super::*;

impl Store {
    pub(super) fn note_relay(&mut self, id: &str, relay: &str) {
        let seen = self.seen_on.entry(id.to_owned()).or_default();
        if seen.len() < MAX_SEEN_RELAYS && !seen.iter().any(|r| r == relay) {
            seen.push(relay.to_owned());
        }
    }

    pub(super) fn index(&mut self, event: Event) {
        self.payload_bytes += event_payload_bytes(&event);
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
        if event.kind == 1111 {
            for address in tag_values(&event, "a") {
                let list = self.by_comment_address.entry(address).or_default();
                if !list.contains(&event.id) {
                    list.push(event.id.clone());
                }
            }
        }
        self.events.insert(event.id.clone(), event);
    }

    pub(super) fn remove(&mut self, id: &str) {
        let Some(event) = self.events.remove(id) else {
            return;
        };
        if let Ok(Some(at)) = expiration::deadline(&event) {
            self.expiry_deadlines.remove(&(at, id.to_owned()));
        }
        self.generations.remove(id);
        self.snapshot_revision = self.revision;
        self.payload_bytes = self
            .payload_bytes
            .saturating_sub(event_payload_bytes(&event));
        if is_replaceable_kind(event.kind) {
            self.replaceable.remove(&(event.pubkey.clone(), event.kind));
            if event.kind == 0 {
                self.profiles.remove(&event.pubkey);
                self.verified_nip05.remove(&event.pubkey);
            }
        }
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
        if event.kind == 1111 {
            for address in tag_values(&event, "a") {
                if let Some(list) = self.by_comment_address.get_mut(&address) {
                    list.retain(|comment| comment != id);
                    if list.is_empty() {
                        self.by_comment_address.remove(&address);
                    }
                }
            }
        }
        self.seen_on.remove(id);
    }
}
