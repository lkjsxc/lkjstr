//! Bounded event loss evidence, indexed by time and by eviction order.
use super::{MAX_DELETED, Store};
use lkjstr_protocol::NostrEvent;
use std::hash::{BuildHasher, BuildHasherDefault, DefaultHasher};

const TAGS_PER_FENCE: usize = 32;

fn fingerprint(kind: &str, value: &str) -> u64 {
    BuildHasherDefault::<DefaultHasher>::default().hash_one((kind, value))
}

#[derive(Clone)]
pub(super) struct Fence {
    pub sequence: u64,
    pub at: u64,
    pub kind: u64,
    pub author: String,
    tags: Vec<u64>,
    tags_truncated: bool,
}

impl Fence {
    pub(super) fn heap_bytes(&self) -> usize {
        self.author.capacity() + self.tags.capacity() * std::mem::size_of::<u64>()
    }
}

impl Store {
    pub(super) fn remember_eviction(&mut self, event: &NostrEvent) {
        let mut tags: Vec<_> = event
            .tags
            .iter()
            .filter_map(|tag| match tag.as_slice() {
                [kind, value, ..] if kind.len() == 1 => Some(fingerprint(kind, value)),
                _ => None,
            })
            .take(TAGS_PER_FENCE + 1)
            .collect();
        let tags_truncated = tags.len() > TAGS_PER_FENCE;
        tags.truncate(TAGS_PER_FENCE);
        let fence = Fence {
            sequence: self.evictions,
            at: event.created_at,
            kind: event.kind,
            author: event.pubkey.clone(),
            tags,
            tags_truncated,
        };
        let key = (fence.at, event.id.clone());
        if self.evicted.len() == MAX_DELETED
            && let Some((sequence, id)) = self.evicted_order.pop_first()
            && let Some(old) = self.evicted.remove(&id)
        {
            debug_assert_eq!(sequence, old.sequence);
            self.evicted_times.remove(&(old.at, id));
        }
        self.evicted_order
            .insert((fence.sequence, event.id.clone()));
        self.evicted_times.insert(key);
        self.evicted.insert(event.id.clone(), fence);
    }

    pub(super) fn resolve_eviction(&mut self, id: &str, network_refetch: bool) {
        if let Some(fence) = self.evicted.remove(id) {
            self.evicted_order.remove(&(fence.sequence, id.to_owned()));
            self.evicted_times.remove(&(fence.at, id.to_owned()));
            self.ghost_hits += u64::from(network_refetch);
            if network_refetch
                && let Some(class) = crate::engine::fetch_records::ResourceClass::event(fence.kind)
            {
                self.fetches
                    .count(class, |t| t.ghost_hits = t.ghost_hits.saturating_add(1));
            }
        }
    }

    pub(crate) fn eviction_gap(&self, filter: &lkjstr_protocol::NostrFilter) -> Option<u64> {
        self.eviction_target(filter).map(|(at, _)| at)
    }

    pub(crate) fn eviction_target(
        &self,
        filter: &lkjstr_protocol::NostrFilter,
    ) -> Option<(u64, &str)> {
        let since = filter.since.unwrap_or(0);
        let until = filter.until.unwrap_or(u64::MAX);
        self.evicted_times
            .range((since, String::new())..)
            .take_while(|(at, _)| *at <= until)
            .filter_map(|(_, id)| self.evicted.get(id).map(|fence| (id, fence)))
            .find(|(id, fence)| {
                filter
                    .ids
                    .as_ref()
                    .is_none_or(|ids| ids.iter().any(|prefix| id.starts_with(prefix)))
                    && filter
                        .kinds
                        .as_ref()
                        .is_none_or(|ks| ks.contains(&fence.kind))
                    && filter.authors.as_ref().is_none_or(|authors| {
                        authors
                            .iter()
                            .any(|prefix| fence.author.starts_with(prefix))
                    })
                    && (fence.tags_truncated
                        || filter.tags.iter().all(|(kind, values)| {
                            values
                                .iter()
                                .any(|value| fence.tags.contains(&fingerprint(kind, value)))
                        }))
            })
            .map(|(id, fence)| (fence.at, id.as_str()))
    }
}
