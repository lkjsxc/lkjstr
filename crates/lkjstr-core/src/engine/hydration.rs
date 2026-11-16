//! Visible-author hydration. At most 6000 authors per view, shared per relay.
use super::{
    Engine, View,
    protocol::{Query, Source},
};
use crate::{
    content::{Segment, segments},
    store::{Event, Store},
};
use lkjstr_protocol::{NostrFilter, event_references, tags::tag_values};
use std::collections::{BTreeMap, BTreeSet};

// Retained history keeps its rows without hydrating every retained person at once.
fn person_window(view: &View, at: usize, len: usize) -> std::ops::Range<usize> {
    let end = at
        .saturating_add(view.after.saturating_add(1).min(60))
        .min(len);
    at.saturating_sub(view.before.min(60)).min(end)..end
}

pub(super) fn authors(
    store: &Store,
    view: &View,
    network: &super::network::Network,
    enabled: bool,
    private: &super::settings::PrivateLists,
) -> BTreeMap<String, BTreeSet<String>> {
    fn visit(store: &Store, e: &Event, depth: usize, out: &mut BTreeMap<String, BTreeSet<String>>) {
        let relays: BTreeSet<_> = store.seen_on(&e.id).iter().cloned().collect();
        for key in std::iter::once(e.pubkey.clone()).chain(tag_values(e, "p").into_iter().take(3)) {
            if out.len() < 6000 || out.contains_key(&key) {
                out.entry(key).or_default().extend(relays.clone());
            }
        }
        // Repost headers are projected from referencing wrappers, not just targets.
        for wrapper in store
            .referencing(&e.id)
            .into_iter()
            .filter(|r| matches!(r.kind, 6 | 16))
            .take(3)
        {
            if out.len() < 6000 || out.contains_key(&wrapper.pubkey) {
                out.entry(wrapper.pubkey.clone())
                    .or_default()
                    .extend(store.seen_on(&wrapper.id).iter().cloned());
            }
        }
        if depth == 2 {
            return;
        }
        let ids = event_references(e).into_iter().map(|r| r.id).chain(
            segments(&e.content, &[])
                .into_iter()
                .filter_map(|s| match s {
                    Segment::Quote { id, .. } => Some(id),
                    _ => None,
                }),
        );
        for id in ids.take(120) {
            if let Some(target) = store.get(&id) {
                visit(store, &target, depth + 1, out);
            }
        }
    }
    if matches!(view.query.source, Source::Following | Source::List) {
        let keys = if view.query.source == Source::Following {
            store
                .follows(view.query.target.as_deref().unwrap_or(""))
                .unwrap_or_default()
        } else {
            super::list_events::events(store, &view.query, private)
                .first()
                .map(|e| {
                    let mut seen = BTreeSet::new();
                    super::settings::list_tags_for(e, private, view.query.account.as_deref())
                        .into_iter()
                        .filter(|t| t.first().is_some_and(|k| k == "p"))
                        .filter_map(|t| t.get(1).cloned())
                        .filter(|p| lkjstr_protocol::is_pubkey(p) && seen.insert(p.clone()))
                        .collect()
                })
                .unwrap_or_default()
        };
        let at = view
            .anchor
            .as_ref()
            .and_then(|key| keys.iter().position(|p| p == key))
            .unwrap_or(0);
        return keys[person_window(view, at, keys.len())]
            .iter()
            .cloned()
            .map(|p| (p, BTreeSet::new()))
            .collect();
    }
    let events = super::list_events::events(store, &view.query, private);
    let mut out: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let range = if view.query.source == Source::Followers {
        let at = view
            .anchor
            .as_ref()
            .and_then(|key| {
                events
                    .iter()
                    .position(|e| super::rich::anchored(e, key, &view.query))
            })
            .unwrap_or(0);
        person_window(view, at, events.len())
    } else {
        super::windows::selection(store, network, view, enabled, &events, private).0
    };
    let window: Vec<_> = events[range]
        .iter()
        .filter(|event| {
            view.query.source == Source::Followers
                || super::query::hidden_with_lists(store, &view.query, event, private).is_none()
        })
        .collect();
    // Reserve every row author before bounded recursive context hydration.
    for e in &window {
        out.entry(e.pubkey.clone())
            .or_default()
            .extend(store.seen_on(&e.id).iter().cloned());
    }
    if view.query.source != Source::Followers {
        for e in &window {
            visit(store, e, 0, &mut out);
        }
    }
    if matches!(
        view.query.source,
        Source::Profile | Source::Following | Source::TheirHome
    ) && let Some(target) = &view.query.target
    {
        out.entry(target.clone()).or_default();
    }
    out
}

impl Engine {
    pub(super) fn profile_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        // 128 visible views x 6000 authors; requests chunk at 120 per relay.
        let mut batches: BTreeMap<String, BTreeMap<String, BTreeSet<String>>> = BTreeMap::new();
        let reads: Vec<_> = self
            .network
            .relay_order
            .iter()
            .filter(|u| self.network.known.get(*u).is_none_or(|r| r.read))
            .cloned()
            .collect();
        for (sub, view) in self.views.iter().filter(|(_, v)| v.visible) {
            let weights = super::weights::Weights::new(
                &self.store,
                &self.private_lists,
                view.query.account.as_deref(),
            );
            let mut people: Vec<_> = authors(
                &self.store,
                view,
                &self.network,
                self.signed_out_global_filter,
                &self.private_lists,
            )
            .into_iter()
            .filter(|(author, _)| {
                matches!(
                    view.query.source,
                    Source::Following | Source::Followers | Source::List
                ) || weights.person(author) > 0
            })
            .collect();
            people.sort_by_key(|(author, _)| {
                (std::cmp::Reverse(weights.person(author)), author.clone())
            });
            people.truncate(6000);
            for (author, seen) in people {
                if self.store.profile(&author).is_some() {
                    continue;
                }
                let delivered: Vec<_> = seen
                    .into_iter()
                    .filter(|u| reads.contains(u))
                    .take(1)
                    .collect();
                let first = if delivered.is_empty() {
                    reads.iter().take(1).cloned().collect()
                } else {
                    delivered
                };
                let routes = if self.network.profile_finished(&author, &first) {
                    reads
                        .iter()
                        .take(2)
                        .cloned()
                        .chain(first.iter().cloned())
                        .collect()
                } else {
                    first
                };
                for relay in routes {
                    batches
                        .entry(relay)
                        .or_default()
                        .entry(author.clone())
                        .or_default()
                        .insert(sub.clone());
                }
            }
        }
        let mut wants = Vec::new();
        for (relay, people) in batches {
            let people: Vec<_> = people.into_iter().collect();
            for chunk in people.chunks(120) {
                let filter = NostrFilter {
                    authors: Some(chunk.iter().map(|(a, _)| a.clone()).collect()),
                    kinds: Some(vec![0]),
                    limit: Some(chunk.len() as u64),
                    ..Default::default()
                };
                let members: BTreeSet<_> = chunk
                    .iter()
                    .flat_map(|(_, subs)| subs.iter().cloned())
                    .collect();
                for sub in members {
                    wants.push((
                        sub,
                        filter.clone(),
                        Query {
                            source: Source::Relay,
                            target: Some(relay.clone()),
                            ..Default::default()
                        },
                    ));
                }
            }
        }
        wants
    }
}
