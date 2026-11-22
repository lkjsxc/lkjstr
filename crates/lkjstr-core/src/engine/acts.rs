//! Bounded act chains. Each resolution retains at most four events; representatives
//! retain at most one entry per event in the already bounded source slice.
use super::protocol::{Query, Source};
use crate::{
    kinds::{ActKind, policy},
    store::{Event, Store},
};
use lkjstr_protocol::NostrEvent;
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn is_act(kind: u64) -> bool {
    policy(kind).act.is_some()
}
pub(super) fn target(event: &NostrEvent) -> Option<String> {
    event
        .tags
        .iter()
        .rev()
        .find(|tag| tag.first().is_some_and(|v| v == "e"))
        .and_then(|tag| tag.get(1))
        .filter(|id| lkjstr_protocol::is_event_id(id))
        .cloned()
}
pub(super) fn activity(query: &Query) -> bool {
    query.source == Source::Profile
        && matches!(query.filters.show.as_deref(), Some("reactions" | "reposts"))
}
#[derive(Default)]
pub(super) struct Chain {
    pub first: Option<Event>,
    pub note: Option<Event>,
    pub missing: Option<String>,
    pub links: Vec<Event>,
}
impl Chain {
    pub fn rank(&self) -> u8 {
        match self.first.as_ref().and_then(|event| policy(event.kind).act) {
            Some(ActKind::Repost | ActKind::Reaction) => 2,
            Some(ActKind::Zap) => 1,
            _ => 0,
        }
    }
    pub fn trusted(&self, engine: &super::Engine) -> bool {
        self.links.iter().all(|event| {
            policy(event.kind).act != Some(ActKind::Zap)
                || engine.zaps.receipts.get(&engine.store, &event.id).is_some()
        })
    }
}
/// The supplied id is already one edge from the newest act. Four total edges
/// are allowed; malformed or cyclic chains never schedule another lookup.
pub(super) fn from_target(store: &Store, id: &str) -> Chain {
    let mut out = Chain::default();
    let mut next = id.to_owned();
    let mut seen = BTreeSet::new();
    for edge in 1..=4 {
        if !lkjstr_protocol::is_event_id(&next) || !seen.insert(next.clone()) {
            return out;
        }
        let Some(event) = store.get(&next) else {
            out.missing = Some(next);
            return out;
        };
        if edge == 1 {
            out.first = Some(event.clone());
        }
        if !is_act(event.kind) {
            // Keep activity grouping limited to its existing terminal-note semantics.
            if policy(event.kind).act_terminal {
                out.note = Some(event);
            }
            return out;
        }
        out.links.push(event.clone());
        if edge == 4 {
            return out;
        }
        let Some(id) = target(&event) else {
            return out;
        };
        next = id;
    }
    out
}
pub(super) fn resolve(store: &Store, event: &NostrEvent) -> Chain {
    target(event)
        .map(|id| from_target(store, &id))
        .unwrap_or_default()
}
/// All projections, filtering, history and hydration select the same raw act.
pub(super) fn representatives(store: &Store, events: Vec<Event>) -> Vec<Event> {
    let mut chosen: BTreeMap<String, (u8, Event)> = BTreeMap::new();
    for event in events {
        let chain = resolve(store, &event);
        let key = chain
            .note
            .as_ref()
            .map(|note| note.id.clone())
            .unwrap_or_else(|| event.id.clone());
        let rank = chain.rank();
        let candidate = (rank, event.created_at, &event.id);
        if chosen
            .get(&key)
            .is_none_or(|(old_rank, old)| candidate > (*old_rank, old.created_at, &old.id))
        {
            chosen.insert(key, (rank, event));
        }
    }
    let mut out: Vec<_> = chosen.into_values().map(|(_, event)| event).collect();
    out.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    out
}
pub(super) fn reposts(store: &Store, id: &str) -> impl Iterator<Item = Event> {
    store.referencing(id).into_iter().filter(move |event| {
        policy(event.kind).act == Some(ActKind::Repost) && target(event).as_deref() == Some(id)
    })
}

pub(super) fn matches_terminal(store: &Store, event: &NostrEvent, query: &Query) -> bool {
    let chain = resolve(store, event);
    let Some(note) = chain.note else {
        return chain.missing.is_some();
    };
    let mut shown = query.clone();
    shown.filters.authors = None;
    shown.filters.from = None;
    shown.filters.since = None;
    shown.filters.until = None;
    super::query_predicates::matches_extra(&note, &shown)
}

/// Chain expansion contributes terminal-note references, never arbitrary ancestor
/// tags or receipt JSON. The window bounds this temporary collection.
pub(super) fn reference_rows(store: &Store, events: &[Event]) -> Vec<Event> {
    events
        .iter()
        .filter_map(|event| {
            if is_act(event.kind) {
                resolve(store, event).note
            } else {
                Some(event.clone())
            }
        })
        .collect()
}

/// Exclude known unrelated notifications before their wants consume a window.
/// Unknown targets stay provisional until their signed author is available.
pub(super) fn notification_visible(store: &Store, query: &Query, event: &NostrEvent) -> bool {
    if query.source != Source::Notifications {
        return true;
    }
    let Some(account) = query.account.as_deref() else {
        return false;
    };
    event.pubkey != account
        && !(is_act(event.kind)
            && target(event)
                .and_then(|id| store.get(&id))
                .is_some_and(|target| is_act(target.kind) && target.pubkey != account))
}
