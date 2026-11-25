//! Verified ingress shares one immutable payload with its persistence lease.
use super::*;

impl Store {
    pub fn insert(&mut self, event: NostrEvent, relay: Option<&str>) -> Inserted {
        self.insert_inner(event, relay, false).0
    }

    pub(crate) fn insert_deferred(&mut self, event: NostrEvent, relay: Option<&str>) -> Inserted {
        self.insert_inner(event, relay, self.weighted).0
    }

    pub(crate) fn insert_leased(
        &mut self,
        event: NostrEvent,
        relay: Option<&str>,
    ) -> (Inserted, Option<Lease>) {
        self.insert_inner(event, relay, self.weighted)
    }

    fn insert_inner(
        &mut self,
        event: NostrEvent,
        relay: Option<&str>,
        deferred: bool,
    ) -> (Inserted, Option<Lease>) {
        let Ok(encoding) = compact::Encoding::of(&event) else {
            return (Inserted::InvalidEncoding, None);
        };
        let outcome = self.prepare_insert(&event, encoding.id(), encoding.author(), relay);
        let lease = if outcome == Inserted::Duplicate {
            self.events.get(&encoding.id()).cloned()
        } else {
            Some(self.compact.pack_encoded(event, encoding))
        };
        if matches!(outcome, Inserted::New | Inserted::Replaced)
            && let Some(lease) = &lease
        {
            self.index(lease.clone());
            self.revision += 1;
            if !deferred {
                self.evict();
            }
        }
        (outcome, lease)
    }

    fn prepare_insert(
        &mut self,
        event: &NostrEvent,
        id: Id,
        author: Id,
        relay: Option<&str>,
    ) -> Inserted {
        if self.was_deleted(&event.id, &event.pubkey) || self.address_deletions.covers(event) {
            self.apply_verified_deletion(&event.id);
            return Inserted::Deleted;
        }
        if self.events.contains_key(&id) {
            if let Some(relay) = relay {
                self.note_relay(id, relay);
            }
            return Inserted::Duplicate;
        }
        let deadline = match expiration::deadline(event) {
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
            let slot = (author, event.kind);
            if let Some(old) = self
                .replaceable
                .get(&slot)
                .and_then(|id| self.events.get(id))
            {
                if old.order.0 > event.created_at
                    || (old.order.0 == event.created_at && old.id() < &id)
                {
                    return Inserted::Stale;
                }
                let old_id = old.id_hex();
                self.remove(&old_id);
                outcome = Inserted::Replaced;
            }
            self.replaceable.insert(slot, id);
            if event.kind == 0 {
                self.profiles.insert(
                    event.pubkey.clone(),
                    Arc::new(Profile::parse(&event.content)),
                );
            }
        }
        if let Some(replaced) = self.replace_address(event) {
            match replaced {
                Inserted::Stale => return Inserted::Stale,
                _ => outcome = replaced,
            }
        }
        if event.kind == 5 {
            self.apply_deletion(event);
        }
        if let Some(relay) = relay {
            self.note_relay(id, relay);
        }
        if let Some(deadline) = deadline {
            self.expiry_deadlines.insert((deadline, event.id.clone()));
        }
        self.resolve_eviction(&event.id, relay.is_some_and(|url| url.starts_with("ws")));
        self.access
            .record(&id, self.now_seconds / 60, self.keep.inflation());
        self.record_insert(event, id);
        outcome
    }
}
