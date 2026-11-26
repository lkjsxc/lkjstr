//! Route-local lower bounds for a merged chronological view.
use super::*;
use crate::store::Store;

const HISTORY_WAIT_MS: u64 = 4_000;

impl Request {
    fn history_floor(&self, store: &Store, now: u64) -> Option<u64> {
        let deadline = self.created_at.saturating_add(HISTORY_WAIT_MS);
        if self.page_eose && self.page_answered_at.is_some_and(|at| at < deadline) {
            return if self.received.len() >= self.page_limit {
                self.oldest
            } else {
                self.cached_until
            };
        }
        if self.complete && !self.page_eose || now >= deadline {
            return None;
        }
        // NIP-01 orders the initial results newest first. Follow the streamed
        // page while it arrives, then use the completed page's actual limit.
        let oldest_verified = self
            .received
            .iter()
            .filter_map(|id| {
                self.received
                    .timestamp(id)
                    .filter(|at| store.lease(id).is_some_and(|event| event.order.0 == *at))
            })
            .min();
        Some(oldest_verified.unwrap_or_else(|| self.filter.until.unwrap_or(self.created_at / 1000)))
    }
}

impl Network {
    pub(in crate::engine) fn history_horizon(
        &self,
        store: &Store,
        sub: &str,
        head: NostrFilter,
        active: Option<&NostrFilter>,
    ) -> Option<u64> {
        let head = crate::engine::filter_identity::canonical(head);
        let active = active
            .filter(|page| {
                let mut family = (*page).clone();
                family.until = head.until;
                want_key::same(&family, &head)
            })
            .cloned()
            .map(crate::engine::filter_identity::canonical);
        let repair_owner = format!("~repair:{sub}");
        let pages: BTreeMap<_, _> = self
            .requests
            .values()
            .filter(|r| r.owns_time(None) && r.members.contains(sub))
            .filter(|r| active.as_ref() == Some(&r.page_filter))
            .map(|r| (r.relay.as_str(), r))
            .collect();
        self.requests
            .values()
            .filter(|r| r.owns_time(None) && r.members.contains(sub) && r.page_filter == head)
            .filter_map(|r| {
                let floor = r.history_floor(store, self.now)?;
                if !r.page_eose || r.page_answered_at.is_none() {
                    return Some(floor);
                }
                if let Some(page) = pages
                    .get(r.relay.as_str())
                    .filter(|p| p.created_at >= r.created_at)
                {
                    return page.history_floor(store, self.now);
                }
                if let Some(boundary) = r.cached_until.filter(|boundary| *boundary >= floor) {
                    let mut repair = head.clone();
                    repair.until = Some(boundary);
                    if let Some(page) = self.requests.values().find(|p| {
                        p.relay == r.relay
                            && p.members.contains(&repair_owner)
                            && p.page_filter == repair
                    }) {
                        return page.history_floor(store, self.now);
                    }
                }
                Some(floor)
            })
            .chain(pages.values().filter_map(|page| {
                // An older read may keep a permitted route after its live slot
                // rotates. Its local continuation still contributes coverage.
                (!self.requests.values().any(|r| {
                    r.relay == page.relay && r.page_filter == head && r.members.contains(sub)
                }))
                .then(|| page.history_floor(store, self.now))
                .flatten()
            }))
            .max()
    }

    pub(in crate::engine) fn waiting_for_follows(
        &self,
        store: &Store,
        sub: &str,
        owner: &str,
    ) -> bool {
        self.requests.values().any(|r| {
            r.members.contains(sub)
                && r.page_filter
                    .authors
                    .as_ref()
                    .is_some_and(|a| a.len() == 1 && a[0] == owner)
                && r.page_filter.kinds.as_ref().is_some_and(|k| k.contains(&3))
                && r.history_floor(store, self.now).is_some()
        })
    }
}
