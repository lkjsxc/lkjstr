//! Bounded per-relay proof that a finite follower page has already been delivered.
use super::*;

// Nostr has no generic "exclude these IDs" filter. Replaying a completed
// #p/kind-3 lookup immediately downloads large replaceable follow lists again.
// A full page proves the first page was delivered, NOT that followers are
// exhausted. Keep that page until the user can deliberately request a cursor;
// this prevents downloading the same huge replaceable lists again on a replan.
// A short page can prove absence briefly. Neither proof crosses relays/targets.
const SHORT_TTL_MS: u64 = 15_000;
const FULL_TTL_MS: u64 = 300_000;
const MAX_CACHED: usize = 256;

fn reusable(r: &Request, now: u64) -> bool {
    r.asked
        && r.complete
        && r.page_eose
        && !r.live
        && !r.sent
        && !r.verification_retry
        && now.saturating_sub(r.last_rx)
            <= if r.received.len() >= r.page_limit {
                FULL_TTL_MS
            } else {
                SHORT_TTL_MS
            }
        && r.page_filter.kinds.as_deref() == Some(&[3])
        && r.page_filter.tags.len() == 1
        && r.page_filter.tags.contains_key("p")
        && r.page_filter.authors.is_none()
        && r.page_filter.ids.is_none()
        && r.page_filter.since.is_none()
        && r.page_filter.until.is_none()
}
impl Network {
    pub(super) fn expire_coverage(&mut self, now: u64) {
        self.requests
            .retain(|_, r| !r.members.is_empty() || reusable(r, now));
    }
    pub(super) fn keep_coverage(&mut self, id: &str, now: u64) -> bool {
        let Some(r) = self.requests.get_mut(id) else {
            return false;
        };
        if !reusable(r, now) || r.members.iter().any(|m| m.starts_with('~')) {
            return false;
        }
        r.members.clear();
        r.read_slot = false;
        true
    }
    pub(super) fn bound_coverage(&mut self) {
        let mut ghosts: Vec<_> = self
            .requests
            .iter()
            .filter(|(_, r)| r.members.is_empty())
            .map(|(id, r)| (r.last_rx, id.clone()))
            .collect();
        ghosts.sort();
        let extra = ghosts.len().saturating_sub(MAX_CACHED);
        for (_, id) in ghosts.into_iter().take(extra) {
            self.requests.remove(&id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn completed(target: &str, at: u64) -> Request {
        let mut filter = NostrFilter {
            kinds: Some(vec![3]),
            limit: Some(200),
            ..Default::default()
        };
        filter.tags.insert("p".into(), vec![target.into()]);
        Request {
            relay: "wss://a.test/".into(),
            wire_id: "w1".into(),
            purpose: "hydration",
            priority: 3,
            weight: 1,
            filter: filter.clone(),
            page_filter: filter,
            members: BTreeSet::from(["profile".into()]),
            read_slot: false,
            verification_retry: false,
            sent: false,
            eose: true,
            page_eose: true,
            deadline: at,
            initial_deadline: at,
            last_event: None,
            sent_at: at.saturating_sub(100),
            last_rx: at,
            complete: true,
            live: false,
            union_safe: false,
            list_watch: false,
            asked: true,
            ready_at: at,
            received: PageFrontier::default(),
            page_limit: 200,
            oldest: None,
            retry_delay: 1000,
        }
    }
    #[test]
    fn completed_follower_query_survives_a_brief_hide_but_expires() {
        let mut network = Network::default();
        network.requests.insert("r1".into(), completed("a", 1000));
        assert!(network.keep_coverage("r1", 1200));
        assert!(network.requests["r1"].members.is_empty());
        network.expire_coverage(16_000);
        assert!(network.requests.contains_key("r1"));
        network.expire_coverage(16_001);
        assert!(!network.requests.contains_key("r1"));
    }
    #[test]
    fn incomplete_and_private_pages_never_create_a_proof_but_full_pages_keep_a_cursor() {
        let mut network = Network::default();
        let mut incomplete = completed("a", 1000);
        incomplete.page_eose = false;
        network.requests.insert("unfinished".into(), incomplete);
        let mut private = completed("b", 1000);
        private.members.insert("~dm:private".into());
        network.requests.insert("private".into(), private);
        let mut full = completed("c", 1000);
        full.page_limit = 0;
        network.requests.insert("full".into(), full);
        for id in ["unfinished", "private"] {
            assert!(!network.keep_coverage(id, 1001));
            assert!(!network.requests[id].members.is_empty());
        }
        assert!(network.keep_coverage("full", 1001));
        assert!(!network.page_exhausted(&network.requests["full"].page_filter));
        network.expire_coverage(301_001);
        assert!(!network.requests.contains_key("full"));
    }
    #[test]
    fn old_coverage_is_evicted_under_a_fixed_memory_budget() {
        let mut network = Network::default();
        for i in 0..(MAX_CACHED + 3) {
            let id = format!("r{i}");
            network
                .requests
                .insert(id.clone(), completed(&id, i as u64));
            assert!(network.keep_coverage(&id, i as u64));
        }
        network.bound_coverage();
        assert_eq!(network.requests.len(), MAX_CACHED);
        for id in ["r0", "r1", "r2"] {
            assert!(!network.requests.contains_key(id));
        }
    }
}
