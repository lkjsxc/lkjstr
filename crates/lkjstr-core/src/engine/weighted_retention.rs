//! Resolve public pinning and reuse weights once per pressure batch.
use super::{Engine, weights::Weights};
use std::collections::BTreeMap;
#[path = "cache_retention.rs"]
mod cache_retention;

impl Engine {
    /// Supply only verified public account IDs before restoring cache rows.
    pub fn set_retention_accounts(&mut self, accounts: &super::accounts::Accounts) {
        self.saved_retention_accounts = accounts
            .entries
            .iter()
            .take(32)
            .map(|account| account.pubkey.clone())
            .collect();
    }

    pub(super) fn trim_store(&mut self) {
        self.store
            .set_persistence_overhead(self.pending.overhead_bytes());
        if !self.store.retention_needed() {
            return;
        }
        let input = self.retention_inputs();
        // A painted note also accesses its author metadata. Otherwise minute=0
        // ages frequently displayed names to the lowest score on every pressure pass.
        for author in &input.visible {
            if let Some(profile) = self.store.replaceable(author, 0) {
                self.store.mark_read(&profile.id);
            }
        }
        for id in &input.held {
            self.store.mark_read(id);
        }
        let policies: Vec<_> = input
            .own
            .iter()
            .map(|key| Weights::new(&self.store, &self.private_lists, Some(key)))
            .collect();
        let mut author_weights = BTreeMap::new();
        let weights = self.store.retention_weights(|kind, pubkey| {
            if !super::network::public_kind_for_optimizer(kind) {
                return 0;
            }
            *author_weights.entry(pubkey.to_owned()).or_insert_with(|| {
                policies
                    .iter()
                    .map(|policy| policy.person(pubkey))
                    .max()
                    .unwrap_or(1)
                    .max(input.affinity.get(pubkey).copied().unwrap_or(0))
            })
        });
        let first_event_ms: BTreeMap<_, _> = self
            .network
            .relays
            .iter()
            .filter_map(|(url, relay)| relay.first_event_ms.map(|ms| (url.clone(), ms)))
            .collect();
        let evictions = self.store.evictions();
        self.store.trim_weighted(
            &input.own,
            &input.held,
            &weights,
            &first_event_ms,
            self.network.optimizer.link.state(),
        );
        if self.store.evictions() != evictions {
            self.cached_history_complete = false;
            for view in self.views.values_mut() {
                view.dirty = true;
            }
        }
    }
}

#[cfg(test)]
#[path = "weighted_retention_test.rs"]
mod tests;
