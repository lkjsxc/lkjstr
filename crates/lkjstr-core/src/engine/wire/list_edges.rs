//! Projected row windows must use their own membership, not raw event positions.
use crate::engine::protocol::Source;
pub(super) fn finite(source: Option<Source>) -> bool {
    source.is_some_and(|source| {
        matches!(
            source,
            Source::Following
                | Source::Mutes
                | Source::List
                | Source::People
                | Source::Bookmarks
                | Source::MediaServers
                | Source::Emoji
                | Source::Relays
        )
    })
}
pub(super) fn projected(source: Source) -> bool {
    finite(Some(source))
        || matches!(
            source,
            Source::Thread
                | Source::Followers
                | Source::Channels
                | Source::Channel
                | Source::Profile
                | Source::Notifications
        )
}

/// Known bookmark IDs still being resolved are not an exhausted source.
pub(super) fn settled(q: Option<&super::Query>, e: &crate::engine::Engine) -> bool {
    let Some(q) = q.filter(|q| q.source == "bookmarks") else {
        return true;
    };
    q.account
        .as_deref()
        .and_then(|a| e.store.replaceable(a, 10003))
        .is_none_or(|list| {
            e.list_tags(&list)
                .iter()
                .filter(|t| t.first().is_some_and(|k| k == "e"))
                .filter_map(|t| t.get(1))
                .filter(|id| lkjstr_protocol::is_event_id(id))
                .all(|id| {
                    e.store.get(id).is_some()
                        || e.network.lookup_complete(id)
                        || e.network.lookup_failed(id)
                })
        })
}
