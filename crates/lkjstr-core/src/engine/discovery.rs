//! Six independent records per device account and route; at most 32 accounts.
use super::{
    Engine,
    protocol::{Query, Source},
    wire::RelayConfig,
};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;
impl Engine {
    /// A single-owner convenience entry point for native engine hosts.
    pub fn discover_account(&mut self, account: Option<String>, relays: Vec<String>, now: u64) {
        self.discover_accounts(account.into_iter().collect(), relays, now);
    }
    /// Cached records never suppress refresh. Removed accounts release their wants.
    /// Up to 32 device accounts, 16 discovery hints and 24 configured routes.
    pub fn discover_accounts(
        &mut self,
        mut accounts: Vec<String>,
        mut relays: Vec<String>,
        now: u64,
    ) {
        accounts.sort();
        accounts.dedup();
        accounts.truncate(32);
        relays.sort();
        relays.dedup();
        relays.truncate(16);
        if self.discovery_accounts == accounts && self.discovery_relays == relays {
            return;
        }
        self.discovery_accounts = accounts;
        self.discovery_relays = relays;
        let urls = self
            .network
            .relay_order
            .iter()
            .filter(|url| {
                self.network
                    .known
                    .get(*url)
                    .is_some_and(|r| r.read || r.write || r.search)
            })
            .cloned()
            .chain(self.discovery_relays.iter().cloned())
            .collect();
        let known = self
            .network
            .known
            .keys()
            .cloned()
            .collect::<std::collections::BTreeSet<_>>();
        self.network.configure(urls, now);
        for (url, r) in &mut self.network.known {
            if !known.contains(url) {
                r.read = false;
                r.write = false;
                r.search = false;
            }
        }
        self.replan(now);
    }
    /// Explicit sign-in refreshes even completed or cursor-resumed requests.
    pub fn refresh_account(&mut self, account: &str, now: u64) {
        let ids: Vec<_> = self
            .network
            .requests
            .iter()
            .filter(|(_, r)| {
                r.members.contains("~account-discovery")
                    && r.filter
                        .authors
                        .as_ref()
                        .is_some_and(|a| a.iter().any(|a| a == account))
            })
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            if let Some(r) = self.network.requests.remove(&id)
                && r.sent
            {
                self.network.close_group(&r.relay, &r.wire_id);
            }
        }
        self.replan(now);
    }
    pub(super) fn discovery_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        if self.network.optimizer.hidden {
            return vec![];
        }
        self.discovery_accounts
            .iter()
            .flat_map(|account| {
                self.network.relay_order.iter().flat_map(move |relay| {
                    [0, 3, 10000, 10001, 10002, 10063].map(|kind| {
                        (
                            "~account-discovery".into(),
                            NostrFilter {
                                authors: Some(vec![account.clone()]),
                                kinds: Some(vec![kind]),
                                limit: Some(1),
                                ..Default::default()
                            },
                            Query {
                                source: Source::Relay,
                                target: Some(relay.clone()),
                                ..Default::default()
                            },
                        )
                    })
                })
            })
            .collect()
    }
}
pub(super) fn legacy_relays(store: &Store, account: &str) -> Option<(String, Vec<RelayConfig>)> {
    let event = store.replaceable(account, 3)?;
    let value: serde_json::Value = serde_json::from_str(&event.content).ok()?;
    let entries = value
        .as_object()?
        .iter()
        .filter_map(|(url, flags)| {
            let url = super::settings::strict_relay(url)?;
            let read = flags.get("read").and_then(|v| v.as_bool()).unwrap_or(true);
            let write = flags.get("write").and_then(|v| v.as_bool()).unwrap_or(true);
            (read || write).then_some(RelayConfig {
                url,
                read,
                write,
                search: false,
            })
        })
        .take(64)
        .collect::<Vec<_>>();
    (!entries.is_empty()).then(|| (event.id.clone(), entries))
}

/// NIP-65 may repeat a URL for separate read and write roles.
pub(super) fn merge_relays(entries: impl Iterator<Item = RelayConfig>) -> Vec<RelayConfig> {
    let mut merged: Vec<RelayConfig> = Vec::new();
    for entry in entries {
        if let Some(old) = merged.iter_mut().find(|old| old.url == entry.url) {
            old.read |= entry.read;
            old.write |= entry.write;
        } else if merged.len() < 64 {
            merged.push(entry);
        }
    }
    merged
}
