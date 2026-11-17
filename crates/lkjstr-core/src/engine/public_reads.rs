//! One eligibility rule for public projections, persistence and read reuse.
use super::{
    protocol::{Query, Source},
    settings::PrivateLists,
};
use crate::store::Store;

pub fn allowed(store: &Store, private: &PrivateLists, query: &Query) -> bool {
    matches!(
        query.source,
        Source::Home
            | Source::Global
            | Source::TheirHome
            | Source::Profile
            | Source::Thread
            | Source::Notifications
            | Source::Search
            | Source::Hashtag
            | Source::Bookmarks
            | Source::List
            | Source::Relay
            | Source::Followers
            | Source::Following
            | Source::Mutes
            | Source::People
            | Source::Channels
            | Source::Channel
            | Source::Emoji
    ) && !query.account.as_ref().is_some_and(|account| {
        // Public event bytes do not make privately selected membership public.
        private
            .keys()
            .any(|id| store.get(id).is_some_and(|event| &event.pubkey == account))
    })
}

#[cfg(test)]
#[path = "public_reads_test.rs"]
mod tests;
