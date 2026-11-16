//! DM work shares the existing scheduler and explicit relay ownership.
use super::{Engine, dm::routing::Want};
use std::collections::BTreeMap;
type Cursors = BTreeMap<(String, String), u64>;
impl Engine {
    /// Internal DM wants are bounded separately from public view subscriptions.
    pub fn set_dm_wants(&mut self, wants: Vec<Want>, now: u64) {
        let wants: Vec<_> = wants.into_iter().take(1024).collect();
        if self.dm_wants != wants {
            self.dm_wants = wants;
            self.replan(now);
        }
    }
    /// Advance only the current, completed full page, preserving timestamp ties.
    pub fn dm_older(&self, account: &str, cursors: &mut Cursors) -> bool {
        let modern = format!("~dm:{account}");
        let legacy = format!("~dm-legacy:{account}");
        let mut next = BTreeMap::new();
        for r in self
            .network
            .requests
            .values()
            .filter(|r| r.page_eose && r.received.len() >= r.page_limit)
        {
            let route = if r.members.contains(&modern) {
                r.relay.as_str()
            } else if r.members.contains(&legacy) {
                "legacy"
            } else {
                continue;
            };
            let key = (account.to_owned(), route.to_owned());
            if r.page_filter.until != cursors.get(&key).copied() {
                continue;
            }
            if let Some(oldest) = r.oldest {
                // Shared legacy cursor follows the shallowest full route/filter.
                let value = next.entry(key).or_insert(oldest);
                *value = (*value).max(oldest);
            }
        }
        let mut changed = false;
        for (key, at) in next {
            if cursors.get(&key).is_none_or(|old| at < *old) {
                cursors.insert(key, at);
                changed = true;
            }
        }
        changed
    }
    pub fn dm_history_more(&self, account: &str, cursors: &Cursors) -> bool {
        let modern = format!("~dm:{account}");
        let legacy = format!("~dm-legacy:{account}");
        self.network.requests.values().any(|r| {
            let route = if r.members.contains(&modern) {
                r.relay.as_str()
            } else if r.members.contains(&legacy) {
                "legacy"
            } else {
                return false;
            };
            r.page_filter.until == cursors.get(&(account.into(), route.into())).copied()
                && (!r.page_eose || r.received.len() >= r.page_limit)
        })
    }
    pub fn dm_publishable(&self, ids: &[String]) -> bool {
        !ids.is_empty()
            && ids.len() + self.network.publications.len() <= 64
            && ids
                .iter()
                .all(|id| !self.network.publications.contains_key(id))
    }
    /// Empty completion, unavailable transport and pending work remain distinguishable.
    pub fn dm_phase(&self, account: &str) -> (&'static str, Option<&'static str>) {
        if self.store.replaceable(account, 10050).is_none() {
            if self.network.list_loaded(&self.store, account, 10050) {
                return ("unsupported", Some("not-found"));
            }
            let state = self.dm_read_phase(&format!("~dm-list:{account}"));
            return if state.0 == "live" {
                ("loading", None)
            } else {
                state
            };
        }
        if let Err(code) = super::dm::routing::inboxes(&self.store, account) {
            return ("unsupported", Some(code));
        }
        self.dm_read_phase(&format!("~dm:{account}"))
    }
    fn dm_read_phase(&self, sub: &str) -> (&'static str, Option<&'static str>) {
        let requests: Vec<_> = self
            .network
            .requests
            .values()
            .filter(|r| r.members.contains(sub))
            .collect();
        if requests.is_empty() {
            return if self.network.relays.is_empty() {
                ("failed", Some("no-relays"))
            } else {
                ("loading", None)
            };
        }
        if requests.iter().all(|r| {
            self.network
                .relays
                .get(&r.relay)
                .is_some_and(|r| !r.online && r.failures > 0)
        }) {
            return ("failed", Some("offline"));
        }
        if requests
            .iter()
            .any(|r| r.page_eose || r.last_event.is_some())
        {
            return ("live", None);
        }
        if requests
            .iter()
            .all(|r| r.complete || (r.asked && self.network.now >= r.initial_deadline))
        {
            return ("failed", Some("timeout"));
        }
        ("loading", None)
    }
}
