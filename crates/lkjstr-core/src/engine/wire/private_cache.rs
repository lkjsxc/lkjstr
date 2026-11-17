//! Private list changes invalidate derivative caches without dropping query/window intent.
use super::{Output, Session};
use serde_json::json;
impl Session {
    /// Call before routing the replacement engine snapshots.
    /// Cached timeline membership can contain private filtering decisions even when hidden.
    pub fn private_cache_changed(&mut self, engine: &crate::engine::Engine) -> Vec<Output> {
        for (sub, (anchor, before, _)) in &mut self.windows {
            let account = self.queries.get(sub).and_then(|q| q.account.as_deref());
            if anchor
                .as_deref()
                .is_some_and(|key| !engine.accepts_private_anchor(account, key))
            {
                *anchor = None;
                *before = 0;
            }
        }
        self.return_keys.retain(|sub, key| {
            engine.accepts_private_anchor(
                self.queries.get(sub).and_then(|q| q.account.as_deref()),
                key,
            )
        });
        self.delivered.clear();
        self.cache_policies.clear();
        self.cache_held.clear();
        self.searches.clear();
        let timelines = std::mem::take(&mut self.timelines);
        timelines
            .into_keys()
            .map(|sub| {
                let mut timeline = json!({
                    "supported":false,"newest":0,"oldest":0,
                    "months":[],"positions":[],"older":true
                });
                if let Some((Some(key), _, _)) = self.windows.get(&sub) {
                    timeline["anchor"] = json!(key);
                }
                Output::Timeline { sub, timeline }
            })
            .collect()
    }
}

#[cfg(test)]
#[path = "private_cache_test.rs"]
mod tests;
