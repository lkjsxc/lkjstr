//! NIP-51 public pin membership. Temporary collections are bounded by the stored list payload.
use super::{Engine, protocol::Query};
use crate::store::{Event, Store};
use lkjstr_protocol::{NostrFilter, UnsignedNostrEvent, is_event_id};
use std::collections::BTreeSet;

pub(super) fn filter(owner: &str) -> NostrFilter {
    NostrFilter {
        authors: Some(vec![owner.into()]),
        kinds: Some(vec![10001]),
        limit: Some(1),
        ..Default::default()
    }
}

/// Public e tags only; the list owner's private content never grants read authority.
pub(super) fn ids(store: &Store, owner: Option<&str>) -> Vec<String> {
    let Some(list) = owner.and_then(|owner| store.replaceable(owner, 10001)) else {
        return vec![];
    };
    let mut seen = BTreeSet::new();
    list.tags
        .iter()
        .filter(|tag| tag.first().is_some_and(|key| key == "e"))
        .filter_map(|tag| tag.get(1))
        .filter(|id| is_event_id(id) && seen.insert((*id).clone()))
        .cloned()
        .collect()
}

pub(super) fn events(store: &Store, query: &Query) -> Vec<Event> {
    ids(store, query.target.as_deref())
        .iter()
        .filter_map(|id| store.get(id))
        .filter(|event| {
            crate::kinds::policy(event.kind).openable
                && super::query::matches_note(store, query, event)
        })
        .collect()
}

/// Existing relay-hint bounds apply to missing pin targets, too.
pub(super) fn relays(store: &Store, owner: Option<&str>) -> Vec<String> {
    let Some(list) = owner.and_then(|owner| store.replaceable(owner, 10001)) else {
        return vec![];
    };
    list.tags
        .iter()
        .filter(|tag| {
            tag.first().is_some_and(|key| key == "e")
                && tag.get(1).is_some_and(|id| is_event_id(id))
        })
        .filter_map(|tag| tag.get(2))
        .filter_map(|url| super::settings::strict_relay(url))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .take(8)
        .collect()
}

/// Every action, including Undo, changes one membership in the latest verified list.
pub(super) fn edit(
    engine: &Engine,
    event: &mut UnsignedNostrEvent,
    id: &str,
    on: bool,
) -> Result<(), &'static str> {
    if !is_event_id(id) {
        return Err("rejected");
    }
    // Removing this account's membership needs no target body or author authority.
    if on {
        let target = engine.store.get(id).ok_or("target-unavailable")?;
        if target.pubkey != event.pubkey {
            return Err("not-author");
        }
        if target.kind != 1 {
            return Err("rejected");
        }
    }
    event.kind = 10001;
    if let Some(previous) = engine.store.replaceable(&event.pubkey, 10001) {
        event.tags.clone_from(&previous.tags);
        event.content.clone_from(&previous.content);
    } else if !engine
        .network
        .list_loaded(&engine.store, &event.pubkey, 10001)
    {
        return Err("list-not-loaded");
    }
    let matches = |tag: &Vec<String>| {
        tag.first().is_some_and(|key| key == "e") && tag.get(1).is_some_and(|value| value == id)
    };
    if on {
        // An idempotent pin preserves existing tag extensions and ordering.
        if !event.tags.iter().any(matches) {
            event.tags.push(vec!["e".into(), id.into()]);
        }
    } else {
        event.tags.retain(|tag| !matches(tag));
    }
    Ok(())
}
