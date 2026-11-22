//! Visible-author hydration. At most 6000 authors per view, shared per relay.
use super::{
    Engine, View,
    protocol::{Query, Source},
};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;
#[path = "hydration_context.rs"]
mod context;
use context::visit;
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
                    .position(|e| super::rich::anchored(store, e, key, &view.query))
            })
            .unwrap_or(0);
        person_window(view, at, events.len())
    } else {
        super::windows::selection(store, network, view, enabled, &events, private).raw
    };
    let window: Vec<_> = events[range]
        .iter()
        .filter(|event| {
            view.query.source == Source::Followers
                || (!super::windows::projection::unavailable(store, &view.query, event)
                    && super::query::hidden_with_lists(store, &view.query, event, private)
                        .is_none())
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

#[path = "hydration_profiles.rs"]
mod profiles;
impl Engine {
    pub(super) fn profile_wants(&self, now: u64) -> Vec<(String, NostrFilter, Query)> {
        profiles::wants(self, now)
    }
}

pub(super) fn people(
    store: &Store,
    query: &Query,
    private: &super::settings::PrivateLists,
) -> Vec<NostrFilter> {
    let authors = super::rich::authors(store, query).unwrap_or_else(|| {
        let account = query.account.as_deref();
        if query.filters.text.as_deref() != Some("") {
            return vec![];
        }
        let weights = super::weights::Weights::new(store, private, account);
        super::mention_people::context(store, account, query.target.as_deref(), &weights)
    });
    if authors.is_empty() {
        vec![]
    } else {
        vec![NostrFilter {
            kinds: Some(vec![0]),
            authors: Some(authors.into_iter().take(32).collect()),
            limit: Some(32),
            ..Default::default()
        }]
    }
}
