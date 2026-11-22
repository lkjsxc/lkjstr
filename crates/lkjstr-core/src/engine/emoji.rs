//! Current public owner-list membership, bounded set discovery and picker projection.
#[path = "emoji_entries.rs"]
mod entries;
#[path = "emoji_limits.rs"]
mod limits;
use super::{Engine, protocol::Query};
use crate::store::{Event, Query as StoreQuery, Store};
pub(super) use entries::{Entry, details, reactions};
use entries::{entries, label};
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrEvent, NostrFilter};
use std::collections::{BTreeMap, BTreeSet};

const MAX_SETS: usize = 32;
const MAX_ROWS: usize = 400;
const MAX_TAGS: usize = 4096;
const MAX_IDENTIFIER: usize = 256;
const MAX_CODE: usize = 64;
const MAX_URL: usize = 2048;

struct Reference {
    address: Coordinate,
    relay: Option<String>,
}
fn references(list: &NostrEvent) -> Vec<Reference> {
    let mut seen = BTreeSet::new();
    list.tags
        .iter()
        .take(MAX_TAGS)
        .filter_map(|tag| {
            if tag.first().is_none_or(|t| t != "a") {
                return None;
            }
            let value = tag
                .get(1)
                .filter(|v| v.len() <= 6 + 64 + 1 + MAX_IDENTIFIER)?;
            let address = Coordinate::parse(value).ok()?;
            if address.kind != 30030
                || address.identifier.is_empty()
                || address.identifier.len() > MAX_IDENTIFIER
                || !lkjstr_protocol::is_pubkey(&address.pubkey)
                || !seen.insert(address.to_string())
            {
                return None;
            }
            Some(Reference {
                address,
                relay: tag
                    .get(2)
                    .and_then(|url| super::settings::strict_relay(url)),
            })
        })
        .take(MAX_SETS + 1)
        .collect()
}

fn filter(reference: &Reference) -> NostrFilter {
    let mut filter = NostrFilter {
        authors: Some(vec![reference.address.pubkey.clone()]),
        kinds: Some(vec![30030]),
        limit: Some(1),
        ..Default::default()
    };
    filter
        .tags
        .insert("d".into(), vec![reference.address.identifier.clone()]);
    filter
}

/// No private tags or arbitrary cached set can grant discovery authority.
/// Wants are reconstructed from a visible view's current verified owner list.
pub(super) fn wants(store: &Store, query: &Query) -> Vec<(NostrFilter, Query)> {
    let Some(account) = query
        .account
        .as_deref()
        .filter(|p| lkjstr_protocol::is_pubkey(p))
    else {
        return vec![];
    };
    let mut wants = vec![(super::query::filter(store, query), query.clone())];
    if let Some(list) = store.replaceable(account, 10030) {
        for reference in references(&list).into_iter().take(MAX_SETS) {
            let mut query = query.clone();
            query.filters.relay_hints = reference.relay.iter().cloned().collect();
            wants.push((filter(&reference), query));
        }
    }
    wants
}

fn selected(store: &Store, references: &[Reference]) -> BTreeMap<String, Event> {
    if references.is_empty() {
        return BTreeMap::new();
    }
    let wanted: BTreeSet<_> = references.iter().map(|r| r.address.to_string()).collect();
    let authors = references
        .iter()
        .map(|r| r.address.pubkey.clone())
        .collect();
    let mut selected = BTreeMap::<String, Event>::new();
    // One indexed scan over bounded retained events, not one full scan per set.
    for event in store.feed(&StoreQuery {
        kinds: vec![30030],
        authors: Some(authors),
        limit: store.len(),
        ..Default::default()
    }) {
        let identifier = event
            .tags
            .iter()
            .find(|t| t.first().is_some_and(|v| v == "d"))
            .and_then(|t| t.get(1))
            .map_or("", String::as_str);
        if identifier.len() > MAX_IDENTIFIER {
            continue;
        }
        let address = format!("30030:{}:{identifier}", event.pubkey);
        if wanted.contains(&address)
            && selected.get(&address).is_none_or(|old| {
                event.created_at > old.created_at
                    || (event.created_at == old.created_at && event.id < old.id)
            })
        {
            selected.insert(address, event);
        }
    }
    selected
}

/// Every distinct source, code and URL keeps its place, with direct entries first.
pub(super) fn rows(store: &Store, account: Option<&str>) -> Vec<Entry> {
    let Some(list) = account.and_then(|a| store.replaceable(a, 10030)) else {
        return vec![];
    };
    let mut references = references(&list);
    references.truncate(MAX_SETS);
    let selected = selected(store, &references);
    let mut result = entries(&list, "");
    for reference in references {
        let Some(event) = selected.get(&reference.address.to_string()) else {
            continue;
        };
        let title = label(event, &reference.address.identifier);
        for entry in entries(event, &title) {
            if result.len() == MAX_ROWS {
                return result;
            }
            result.push(entry);
        }
    }
    result
}

/// Missing references remain unresolved after failure, truncation or raw EOSE
/// with verification pending; cached verified sets are usable immediately.
pub(super) fn settled(engine: &Engine, account: Option<&str>) -> bool {
    let Some(account) = account else { return true };
    if engine.network.verifying {
        return false;
    }
    let Some(list) = engine.store.replaceable(account, 10030) else {
        return engine.network.list_loaded(&engine.store, account, 10030);
    };
    let references = references(&list);
    if references.len() > MAX_SETS
        || limits::limited(&list)
        || rows(&engine.store, Some(account)).len() >= MAX_ROWS
    {
        return false;
    }
    let selected = selected(&engine.store, &references);
    if selected.values().any(|event| limits::limited(event)) {
        return false;
    }
    references.iter().all(|reference| {
        if selected.contains_key(&reference.address.to_string()) {
            return true;
        }
        let filter = filter(reference);
        let requests: Vec<_> = engine
            .network
            .requests
            .values()
            .filter(|r| r.page_filter == filter)
            .collect();
        !requests.is_empty()
            && requests
                .iter()
                .all(|r| r.asked && r.eose && r.received.is_empty() && !r.verification_retry)
    })
}
