//! Device directory: bounded by retained metadata, at most six ranked suggestions.
use super::{Query, sources::person};
use crate::{engine::Engine, store};
use serde_json::Value;
use unicode_normalization::UnicodeNormalization;
fn fold(s: &str) -> String {
    s.nfkc().collect::<String>().to_lowercase()
}
pub(super) fn people(e: &Engine, q: &Query) -> Vec<Value> {
    let store = &e.store;
    let mut keys = if let Some(authors) = &q.authors {
        authors.iter().take(32).cloned().collect::<Vec<_>>()
    } else if let Some(reference) = &q.reference {
        match lkjstr_protocol::decode_nip19(reference.strip_prefix("nostr:").unwrap_or(reference)) {
            Some(lkjstr_protocol::NostrEntity::Npub(p)) => vec![p],
            Some(lkjstr_protocol::NostrEntity::Nprofile(p)) => vec![p.pubkey],
            _ => store.query_name(reference).into_iter().collect(),
        }
    } else {
        let needle = fold(q.text.as_deref().unwrap_or(""));
        if needle.is_empty() {
            return vec![];
        }
        store
            .feed(&store::Query {
                kinds: vec![0],
                limit: 6000,
                ..Default::default()
            })
            .into_iter()
            .filter(|event| {
                store.profile(&event.pubkey).is_some_and(|p| {
                    [
                        p.display_name.as_str(),
                        p.name.as_str(),
                        p.nip05.strip_prefix("_@").unwrap_or(&p.nip05),
                    ]
                    .iter()
                    .any(|s| fold(s).starts_with(&needle))
                })
            })
            .map(|event| event.pubkey.clone())
            .collect()
    };
    let follows = q
        .account
        .as_deref()
        .and_then(|a| store.follows(a))
        .unwrap_or_default();
    let thread =
        q.id.as_deref()
            .map(|id| store.thread(id))
            .unwrap_or_default();
    keys.sort_by_key(|key| {
        (
            if follows.contains(key) {
                0
            } else if thread.iter().any(|ev| &ev.pubkey == key) {
                1
            } else {
                2
            },
            fold(
                &store
                    .profile(key)
                    .and_then(|p| p.label().map(str::to_owned))
                    .unwrap_or_default(),
            ),
            key.clone(),
        )
    });
    keys.dedup();
    keys.into_iter()
        .take(if q.authors.is_some() { 32 } else { 6 })
        .map(|p| person(e, &p, q.account.as_deref()))
        .collect()
}
