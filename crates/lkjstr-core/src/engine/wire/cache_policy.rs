//! Only public projections may survive outside an unlocked Worker session.
use super::{Output, Session};
use crate::engine::Engine;

impl Session {
    fn public_cache_allowed(&self, sub: &str, engine: &Engine) -> bool {
        let Some(query) = self.queries.get(sub) else {
            return false;
        };
        if !matches!(
            query.source.as_str(),
            "home"
                | "global"
                | "their-home"
                | "profile"
                | "thread"
                | "notifications"
                | "search"
                | "hashtag"
                | "bookmarks"
                | "list"
                | "relay"
                | "followers"
                | "following"
                | "mutes"
                | "people"
                | "channels"
                | "channel"
                | "emoji"
        ) {
            return false;
        }
        // A public note selected by private membership is still a private projection.
        // Conservatively fence every account-scoped projection while such policy exists.
        !query.account.as_ref().is_some_and(|account| {
            engine.private_lists.keys().any(|id| {
                engine
                    .store
                    .get(id)
                    .is_some_and(|event| &event.pubkey == account)
            })
        })
    }

    pub(super) fn cache_policy(
        &mut self,
        sub: Option<&str>,
        output: &mut Vec<Output>,
        engine: &Engine,
    ) {
        let Some(sub) = sub else { return };
        if !self.queries.contains_key(sub) {
            return;
        }
        let allow = self.public_cache_allowed(sub, engine);
        if self.cache_policies.get(sub) == Some(&allow) {
            return;
        }
        self.cache_policies.insert(sub.to_owned(), allow);
        output.insert(
            0,
            Output::CachePolicy {
                sub: sub.to_owned(),
                allow,
            },
        );
    }
}

#[cfg(test)]
#[path = "cache_policy_test.rs"]
mod tests;
