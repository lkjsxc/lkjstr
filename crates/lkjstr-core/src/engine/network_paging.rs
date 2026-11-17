//! Each route advances its own historical tail; completion is the route union.
//! Evidence lives in requests and is released with the last owning view.
use super::*;
impl Network {
    pub fn page_finished(&self, filter: &lkjstr_protocol::NostrFilter) -> bool {
        let requests: Vec<_> = self
            .requests
            .values()
            .filter(|r| want_key::same(&r.page_filter, filter))
            .collect();
        // An unfinished route remains unknown, but must not veto successful
        // history forever after a refusal or its original page deadline.
        requests.iter().any(|r| r.page_eose)
            && requests.iter().all(|r| {
                r.page_eose
                    || r.complete
                    || (r.asked && self.now >= r.initial_deadline)
                    || self
                        .relays
                        .get(&r.relay)
                        .is_some_and(|relay| !relay.online && relay.failures > 0)
            })
    }

    pub(super) fn preceding_page(&self, request: &Request, logical: &NostrFilter) -> bool {
        if logical.until.is_none() || want_key::same(&request.page_filter, logical) {
            return false;
        }
        let mut family = request.page_filter.clone();
        family.until = logical.until;
        want_key::same(&family, logical) && self.page_cursor(&request.page_filter) == logical.until
    }
    pub(super) fn pending_page_routes(&self, sub: &str, logical: &NostrFilter) -> Vec<String> {
        self.requests
            .values()
            // A full completed page also owes its remaining tail. Another view
            // may already occupy both ordinary slots at the next cursor.
            .filter(|r| {
                (!r.page_eose || r.received.len() >= r.page_limit)
                    && r.members.contains(sub)
                    && self.preceding_page(r, logical)
            })
            .map(|r| r.relay.clone())
            .collect()
    }
    pub(super) fn page_request(
        &self,
        relay: &str,
        logical: &NostrFilter,
        members: &BTreeSet<String>,
    ) -> (NostrFilter, bool, Option<String>) {
        if logical.until.is_none() {
            return (logical.clone(), false, None);
        }
        let previous = self
            .requests
            .iter()
            .filter(|(_, r)| {
                r.relay == relay
                    && !r.members.is_disjoint(members)
                    && self.preceding_page(r, logical)
            })
            .min_by_key(|(_, r)| r.page_filter.until.unwrap_or(u64::MAX));
        let Some((id, previous)) = previous else {
            return (logical.clone(), false, None);
        };
        // A failed or interrupted route still owes the whole original span.
        // Borrowing another route's cursor would silently lose that route's gap.
        if !previous.page_eose {
            return (previous.filter.clone(), false, Some(id.clone()));
        }
        let mut filter = logical.clone();
        // A recovered route can make the union cursor newer while it catches up.
        // Already successful routes keep their own tail; they never rewind.
        let exhausted = previous.received.len() < previous.page_limit;
        filter.until = previous.oldest.or(previous.filter.until).or(logical.until);
        (filter, exhausted, None)
    }
}
impl Request {
    pub(super) fn retryable_page_timeout(&self) -> bool {
        !self.page_eose && self.ready_at > self.deadline && self.ready_at != u64::MAX
    }
}
