//! Profile/list freshness is independent of signed created_at. At most 2048 live stamps.
use super::*;
use crate::store::Store;
use serde::{Deserialize, Serialize};
pub(super) fn ttl(kind: u64) -> u64 {
    if matches!(kind, 3 | 10002) {
        300_000
    } else {
        900_000
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub(super) struct Stamp {
    author: String,
    kind: u64,
    id: String,
    #[serde(default)]
    created_at: u64,
    at: u64,
}
#[derive(Default)]
pub(super) struct Freshness {
    entries: BTreeMap<(String, u64), Stamp>,
    // Failed/empty lookups retry after 30 seconds; never record successful absence.
    retry: BTreeMap<(String, u64), u64>,
}
impl Freshness {
    pub fn observed(&mut self, event: &NostrEvent, now: u64) -> bool {
        if !matches!(event.kind, 0 | 3 | 10002) {
            return false;
        }
        if self
            .entries
            .get(&(event.pubkey.clone(), event.kind))
            .is_some_and(|old| {
                event.created_at < old.created_at
                    || (event.created_at == old.created_at && event.id > old.id)
            })
        {
            return false;
        }
        let stamp = Stamp {
            author: event.pubkey.clone(),
            kind: event.kind,
            id: event.id.clone(),
            created_at: event.created_at,
            at: now,
        };
        self.entries
            .insert((stamp.author.clone(), stamp.kind), stamp);
        self.retry.remove(&(event.pubkey.clone(), event.kind));
        self.bound();
        true
    }
    fn bound(&mut self) {
        while self.entries.len() > 2048 {
            let key = self
                .entries
                .iter()
                .min_by_key(|(_, stamp)| stamp.at)
                .map(|(key, _)| key.clone());
            if let Some(key) = key {
                self.entries.remove(&key);
            }
        }
    }
    // The compatible relay-quality checkpoint keeps the 512 most recent stamps.
    pub fn snapshot(&self, now: u64) -> Vec<Stamp> {
        let mut entries: Vec<_> = self
            .entries
            .values()
            .filter(|stamp| now >= stamp.at && now - stamp.at < ttl(stamp.kind))
            .cloned()
            .collect();
        entries.sort_by_key(|stamp| std::cmp::Reverse(stamp.at));
        entries.truncate(512);
        entries
    }
    pub fn restore<'a>(&mut self, entries: impl Iterator<Item = &'a Stamp>, now: u64) {
        for stamp in entries.take(512).filter(|stamp| {
            matches!(stamp.kind, 0 | 3 | 10002)
                && lkjstr_protocol::is_pubkey(&stamp.author)
                && lkjstr_protocol::is_event_id(&stamp.id)
                && now >= stamp.at
                && now - stamp.at < ttl(stamp.kind)
        }) {
            self.entries
                .insert((stamp.author.clone(), stamp.kind), stamp.clone());
        }
        self.bound();
    }
    pub fn next_expiry(&self, now: u64) -> Option<u64> {
        self.entries
            .values()
            .map(|stamp| stamp.at.saturating_add(ttl(stamp.kind)))
            .chain(self.retry.values().copied())
            .filter(|at| *at > now)
            .min()
    }
}
impl Network {
    pub(in crate::engine) fn metadata_fresh(
        &self,
        store: &Store,
        author: &str,
        kind: u64,
        now: u64,
    ) -> bool {
        let cached = store.replaceable(author, kind);
        let positive = self
            .metadata
            .entries
            .get(&(author.into(), kind))
            .is_some_and(|stamp| {
                cached.as_ref().is_some_and(|event| event.id == stamp.id)
                    && now >= stamp.at
                    && now - stamp.at < ttl(kind)
            });
        // Keep both initial routes until their finite answers settle: an older first
        // record cannot cancel a newer replaceable still arriving from another route.
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                !r.members.contains("~account-discovery")
                    && r.filter.kinds.as_deref() == Some(&[kind])
                    && (kind != 3 || r.filter.tags.is_empty())
                    && r.filter
                        .authors
                        .as_ref()
                        .is_some_and(|keys| keys.iter().any(|key| key == author))
            })
            .collect();
        if requests.iter().any(|r| !r.complete && !r.eose) {
            return false;
        }
        // Missing profiles and follow lists keep completed per-relay evidence so fallback
        // lookup and conservative filtering can distinguish absence from failure.
        if matches!(kind, 0 | 3) && cached.is_none() {
            return false;
        }
        positive
            || self
                .metadata
                .retry
                .get(&(author.into(), kind))
                .is_some_and(|at| now < *at)
            || requests.iter().any(|r| {
                r.asked && (r.complete || r.eose) && now.saturating_sub(r.last_rx) < 30_000
            })
    }
    pub(super) fn metadata_finished(&mut self) {
        if self.verifying {
            return;
        }
        for request in self
            .requests
            .values()
            .filter(|r| r.asked && (r.complete || r.eose))
        {
            let Some([kind @ (0 | 3 | 10002)]) = request.filter.kinds.as_deref() else {
                continue;
            };
            if *kind == 3 && !request.filter.tags.is_empty() {
                continue;
            }
            for author in request.filter.authors.iter().flatten().take(120) {
                self.metadata.retry.insert(
                    (author.clone(), *kind),
                    request.last_rx.saturating_add(30_000),
                );
            }
        }
        while self.metadata.retry.len() > 2048 {
            let key = self
                .metadata
                .retry
                .iter()
                .min_by_key(|(_, at)| **at)
                .map(|(key, _)| key.clone());
            if let Some(key) = key {
                self.metadata.retry.remove(&key);
            }
        }
    }
}

#[cfg(test)]
#[path = "network_metadata_test.rs"]
mod tests;

impl Request {
    pub(super) fn metadata_expiry(&self) -> Option<u64> {
        let [kind @ (0 | 3 | 10002)] = self.filter.kinds.as_deref()? else {
            return None;
        };
        (self.asked
            && self.complete
            && !self.live
            && (*kind != 3 || (self.filter.authors.is_some() && self.filter.tags.is_empty())))
        .then(|| {
            self.last_rx.saturating_add(if self.last_event.is_some() {
                ttl(*kind)
            } else {
                30_000
            })
        })
    }
    pub(super) fn refresh_metadata(&mut self, now: u64) {
        if self.metadata_expiry().is_some_and(|at| now >= at) {
            self.complete = false;
            self.eose = false;
            self.page_eose = false;
            self.asked = false;
            self.created_at = now;
            self.first_event_at = None;
            self.last_event = None;
            self.ready_at = now;
            self.retry_delay = 1000;
        }
    }
}
