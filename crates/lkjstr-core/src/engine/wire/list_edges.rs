//! Projected row windows must use their own membership, not raw event positions.
use super::{Session, sources::pinned_header};
use crate::engine::{Engine, protocol::Source};
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
    if let Some(q) = q.filter(|q| q.source == "emoji") {
        return crate::engine::emoji::settled(e, q.account.as_deref());
    }
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

impl Session {
    pub(super) fn source_fresh(&self, sub: &str, e: &Engine) -> (usize, bool) {
        let Some((Some(anchor), before, _)) = self.windows.get(sub) else {
            return (0, false);
        };
        let all = self.project_source(sub, e, false);
        let header = usize::from(pinned_header(&all));
        let count = all
            .iter()
            .position(|r| r["key"].as_str() == Some(anchor))
            .unwrap_or(0)
            .saturating_sub(*before)
            .saturating_sub(header);
        let own_head = count > 0
            && self.queries.get(sub).is_some_and(|q| q.source == "home")
            && all[header]["kind"] == "note"
            && all[header]["mine"]["own"] == true;
        (count, own_head)
    }
    pub(super) fn source_edges(&self, sub: &str, e: &Engine) -> (bool, bool) {
        let all = self.project_source(sub, e, false);
        let (start, end) = self
            .windows
            .get(sub)
            .map(|(anchor, before, after)| {
                let at = anchor
                    .as_ref()
                    .and_then(|key| all.iter().position(|r| r["key"].as_str() == Some(key)))
                    .unwrap_or(0);
                (at.saturating_sub(*before), at.saturating_add(*after))
            })
            .unwrap_or((0, 50));
        (
            start <= usize::from(pinned_header(&all)),
            end >= all.len() && super::list_edges::settled(self.queries.get(sub), e),
        )
    }
}
