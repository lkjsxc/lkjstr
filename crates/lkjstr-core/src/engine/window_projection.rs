//! Ordinary note windows keep unavailable reposts for history and hydration,
//! but those wrappers have no row and cannot consume note positions or counts.
use crate::engine::{
    global::Held,
    protocol::{Query, Source},
};
use crate::store::{Event, Store};
use std::collections::BTreeSet;

pub(in crate::engine) fn unavailable(store: &Store, query: &Query, event: &Event) -> bool {
    if crate::engine::acts::activity(query) {
        return crate::engine::acts::resolve(store, event).note.is_none();
    }
    query.filters.notifications != Some(true)
        && matches!(
            query.source,
            Source::Home
                | Source::Global
                | Source::TheirHome
                | Source::Search
                | Source::Hashtag
                | Source::Relay
        )
        && matches!(event.kind, 6 | 16)
}

pub(in crate::engine) fn count(store: &Store, query: &Query, events: &[Event]) -> usize {
    events
        .iter()
        .filter(|event| !unavailable(store, query, event))
        .count()
}

/// At most 120 distinct missing final targets per raw window, independent of
/// visible-note references. Changing the window changes this bounded demand.
pub(in crate::engine) fn targets(
    events: &[Event],
    held: &[Option<Held>],
    store: &Store,
) -> Vec<String> {
    let mut seen = BTreeSet::new();
    events
        .iter()
        .zip(held)
        .filter(|(_, reason)| **reason == Some(Held::UnavailableRepost))
        .filter_map(|(event, _)| crate::engine::acts::resolve(store, event).missing)
        .filter(|id| lkjstr_protocol::is_event_id(id) && store.get(id).is_none())
        .filter(|id| seen.insert(id.clone()))
        .take(120)
        .collect()
}
