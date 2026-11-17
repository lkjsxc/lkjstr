//! Provider work follows visible rows and finite explicit queries, never a relay callback.
use super::{
    Engine,
    zaps::{Coverage, Failure, Target},
};
use lkjstr_protocol::NostrFilter;
use std::collections::BTreeMap;
impl Engine {
    pub fn zap_refresh(&mut self, now: u64) {
        self.zap_tick(now);
        self.replan(now);
    }
    pub(super) fn zap_tick(&mut self, now: u64) {
        for (person, _) in self.zaps.metadata() {
            if self.network.profile_finished(&person, &[]) {
                self.zaps.metadata_finished(
                    &person,
                    if self.network.profile_absent(&person) {
                        Failure::NotFound
                    } else {
                        Failure::Network
                    },
                    now / 1000,
                );
            }
        }
        let coverage = self
            .zaps
            .jobs
            .receipt_targets()
            .into_iter()
            .map(|t| {
                let state = self.zap_coverage(&t);
                (t, state)
            })
            .collect();
        let mut missing = BTreeMap::new();
        for id in self.zaps.missing_targets(&self.store) {
            if self.network.lookup_failed(&id) {
                missing.insert(Target::Event { id }, Failure::Network);
            } else if self.network.lookup_complete(&id) {
                missing.insert(Target::Event { id }, Failure::NotFound);
            }
        }
        let visible = self.zap_visible(now / 1000);
        if self
            .zaps
            .tick(&self.store, &visible, &coverage, &missing, now / 1000)
        {
            self.replan(now);
        }
        if self.zaps.projection_changed() {
            self.read_contexts
                .receipts_changed(self.zaps.receipts.revision());
            self.invalidate();
        }
    }
    fn zap_coverage(&self, target: &Target) -> Coverage {
        let filter = receipt_filter(target);
        let requests: Vec<_> = self
            .network
            .requests
            .values()
            .filter(|r| r.filter == filter)
            .collect();
        if self.network.verifying
            || requests.is_empty()
            || requests
                .iter()
                .any(|r| !r.asked || !(r.eose || r.complete || r.page_eose))
        {
            return Coverage::Loading;
        }
        if requests.iter().any(|r| !(r.eose || r.page_eose)) {
            return Coverage::Failed;
        }
        if requests.iter().any(|r| r.received.len() >= r.page_limit) {
            return Coverage::Truncated;
        }
        if requests
            .iter()
            .any(|r| r.received.iter().any(|id| self.store.get(id).is_none()))
        {
            return Coverage::Loading;
        }
        Coverage::Observed
    }
}
pub(super) fn receipt_filter(target: &Target) -> NostrFilter {
    let mut filter = NostrFilter {
        kinds: Some(vec![9735]),
        limit: Some(200),
        ..Default::default()
    };
    let (key, value) = match target {
        Target::Event { id } => ("e", id),
        Target::Profile { pubkey } => ("p", pubkey),
    };
    filter.tags.insert(key.into(), vec![value.clone()]);
    filter
}
