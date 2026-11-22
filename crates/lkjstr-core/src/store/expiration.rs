//! Wall-clock admission and removal for verified public note and activity events.
use super::{MAX_DELETED, Store};
use lkjstr_protocol::NostrEvent;

pub(super) fn deadline(event: &NostrEvent) -> lkjstr_nips::Result<Option<u64>> {
    if crate::kinds::policy(event.kind).expires {
        return lkjstr_nips::metadata::expiration_tags(&event.tags);
    }
    Ok(None)
}

impl Store {
    pub fn advance_clock(&mut self, now_seconds: u64) -> bool {
        self.now_seconds = self.now_seconds.max(now_seconds);
        let revision = self.revision;
        while let Some((at, id)) = self.expiry_deadlines.first().cloned() {
            if at > self.now_seconds {
                break;
            }
            self.expiry_deadlines.pop_first();
            if let Some(event) = self.get(&id) {
                self.record_expiration(&id, &event.pubkey);
            }
            self.remove(&id);
        }
        revision != self.revision
    }

    pub(super) fn record_expiration(&mut self, id: &str, author: &str) {
        if self.expired.contains_key(id) {
            return;
        }
        if self.expired.len() == MAX_DELETED
            && let Some(oldest) = self
                .expired
                .iter()
                .min_by_key(|(id, (revision, _))| (*revision, *id))
                .map(|(id, _)| id.clone())
        {
            self.expired.remove(&oldest);
        }
        self.expired_events = self.expired_events.saturating_add(1);
        self.revision = self.revision.saturating_add(1);
        self.expired
            .insert(id.to_owned(), (self.revision, author.to_owned()));
    }

    pub(super) fn expired_author(&self, id: &str) -> Option<&str> {
        self.expired.get(id).map(|(_, author)| author.as_str())
    }

    pub fn verified_expired(&self, id: &str) -> bool {
        self.expired.contains_key(id)
    }

    pub fn expires_at(&self, id: &str) -> Option<u64> {
        self.events
            .get(id)
            .and_then(|event| deadline(event).ok().flatten())
    }

    pub fn expiration_evidence(&self) -> (u64, u64) {
        (self.expired_events, self.invalid_expiration)
    }
}
