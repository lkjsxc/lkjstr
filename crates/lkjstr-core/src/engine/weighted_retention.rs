//! Resolve public pinning and reuse weights once per pressure batch.
use super::{Engine, weights::Weights};
use std::collections::{BTreeMap, BTreeSet};

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
        if !self.store.retention_needed() {
            return;
        }
        let mut own: BTreeSet<_> = self.discovery_accounts.iter().cloned().collect();
        own.extend(self.saved_retention_accounts.iter().cloned());
        own.extend(
            self.views
                .values()
                .filter_map(|view| view.query.account.clone()),
        );
        let held = self
            .views
            .values()
            .flat_map(|view| view.rows.iter().map(|row| row.id.clone()))
            .collect();
        let policies: Vec<_> = own
            .iter()
            .map(|key| Weights::new(&self.store, &self.private_lists, Some(key)))
            .collect();
        let mut author_weights = BTreeMap::new();
        let weights = self.store.retention_weights(|event| {
            if !super::network::public_kind_for_optimizer(event.kind) {
                return 0;
            }
            *author_weights
                .entry(event.pubkey.clone())
                .or_insert_with(|| {
                    policies
                        .iter()
                        .map(|policy| policy.person(&event.pubkey))
                        .max()
                        .unwrap_or(1)
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
            &own,
            &held,
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
