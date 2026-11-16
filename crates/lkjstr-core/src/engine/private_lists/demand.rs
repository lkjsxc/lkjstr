//! A view can request only its account's current supported list events.
use crate::{
    engine::protocol::{Query, Source},
    store::Store,
};
pub fn events(store: &Store, query: &Query) -> Vec<String> {
    let Some(account) = query.account.as_deref() else {
        return Vec::new();
    };
    if matches!(
        query.source,
        Source::Diagnostics | Source::Relays | Source::MediaServers | Source::Emoji
    ) {
        return Vec::new();
    }
    let mut events = Vec::new();
    if let Some(event) = store.replaceable(account, 10000) {
        events.push(event);
    }
    if query.source == Source::Bookmarks {
        if let Some(event) = store.replaceable(account, 10003) {
            events.push(event);
        }
    } else if query.source == Source::List
        && let Some(event) = super::super::query::events(store, query)
            .first()
            .filter(|e| e.kind == 30000 && e.pubkey == account)
    {
        events.push(event.clone());
    }
    events
        .into_iter()
        .filter(|e| !e.content.is_empty())
        .map(|e| e.id.clone())
        .collect()
}
