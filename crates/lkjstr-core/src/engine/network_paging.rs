//! Each route advances its own historical tail; completion is the route union.
//! Evidence lives in requests and is released with the last owning view.
use super::*;
impl Network {
    pub(super) fn page_request(&self, relay: &str, logical: &NostrFilter) -> (NostrFilter, bool) {
        let Some(until) = logical.until else {
            return (logical.clone(), false);
        };
        let previous = self
            .requests
            .values()
            .filter(|r| {
                let mut family = r.page_filter.clone();
                family.until = logical.until;
                r.relay == relay
                    && family == *logical
                    && r.page_eose
                    && r.page_filter.until.is_none_or(|at| at > until)
                    && self.page_cursor(&r.page_filter) == Some(until)
            })
            .min_by_key(|r| r.page_filter.until.unwrap_or(u64::MAX));
        let Some(previous) = previous else {
            return (logical.clone(), false);
        };
        let mut filter = logical.clone();
        // A short successful shard is exhausted; do not ask it again just because
        // another route has more history. Inclusive boundaries preserve ties.
        let exhausted = previous.received.len() < previous.page_limit;
        filter.until = previous.oldest.or(logical.until);
        (filter, exhausted)
    }
}
