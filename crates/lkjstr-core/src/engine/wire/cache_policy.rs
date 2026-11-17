//! Only public projections may survive outside an unlocked Worker session.
use super::{Output, Session};
use crate::engine::Engine;

impl Session {
    pub(super) fn public_cache_allowed(&self, sub: &str, engine: &Engine) -> bool {
        self.queries
            .get(sub)
            .and_then(|query| query.convert())
            .is_some_and(|query| {
                crate::engine::public_reads::allowed(&engine.store, &engine.private_lists, &query)
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
        if !allow {
            self.cache_held.remove(sub);
        }
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
