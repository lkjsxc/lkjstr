//! Finite bookmark membership follows the decrypted/public tag set in tag order.
//! Temporary membership is bounded by the retained list payload and event store.
use super::{
    protocol::{Query, Source},
    settings::PrivateLists,
};
use crate::store::{Event, Store};
use std::collections::BTreeSet;
pub(super) fn events(store: &Store, q: &Query, private: &PrivateLists) -> Vec<Event> {
    if q.source != Source::Bookmarks {
        return super::query::events(store, q);
    }
    let Some(list) = q
        .account
        .as_deref()
        .and_then(|a| store.replaceable(a, 10003))
    else {
        return vec![];
    };
    let mut seen = BTreeSet::new();
    super::settings::list_tags(&list, private)
        .iter()
        .filter(|t| t.first().is_some_and(|k| k == "e"))
        .filter_map(|t| t.get(1))
        .filter(|id| lkjstr_protocol::is_event_id(id) && seen.insert((*id).clone()))
        .filter_map(|id| store.get(id))
        .filter(|event| super::query::matches_note(store, q, event))
        .collect()
}
