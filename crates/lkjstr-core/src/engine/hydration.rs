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

pub(super) fn authors(
    store: &Store,
    view: &View,
    network: &super::network::Network,
    enabled: bool,
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
    let events = super::query::events(store, &view.query);
    let mut out: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let window = &events[super::windows::selection(store, network, view, enabled, &events).0];
    // Reserve every row author before bounded recursive context hydration.
    for e in window {
        out.entry(e.pubkey.clone())
            .or_default()
            .extend(store.seen_on(&e.id).iter().cloned());
    }
    for e in window {
        visit(store, e, 0, &mut out);
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
            for (author, seen) in authors(
                &self.store,
                view,
                &self.network,
                self.signed_out_global_filter,
            ) {
                let delivered: Vec<_> = seen
                    .into_iter()
                    .filter(|u| reads.contains(u))
                    .take(2)
                    .collect();
                let routes = if delivered.is_empty()
                    || (self.store.profile(&author).is_none()
                        && self.network.profile_finished(&author, &delivered))
                {
                    reads
                        .iter()
                        .take(2)
                        .cloned()
                        .chain(delivered.iter().cloned())
                        .collect()
                } else {
                    delivered
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
