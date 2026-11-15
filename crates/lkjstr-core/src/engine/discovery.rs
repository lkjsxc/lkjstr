//! Three requests per route: eight bootstrap, eight hints and eight owner routes.
use super::{
    Engine,
    protocol::{Query, Source},
    wire::RelayConfig,
};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;
impl Engine {
    /// Switching/removing the account releases the previous discovery requests.
    pub fn discover_account(&mut self, account: Option<String>, mut relays: Vec<String>, now: u64) {
        relays.sort();
        relays.dedup();
        relays.truncate(16);
        if self.discovery_account == account && self.discovery_relays == relays {
            return;
        }
        if self.discovery_account != account {
            self.discovery_paused = false;
        }
        self.discovery_account = account;
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
    pub(super) fn discovery_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        if self.discovery_paused {
            return vec![];
        }
        let Some(account) = &self.discovery_account else {
            return vec![];
        };
        self.network
            .relays
            .keys()
            .flat_map(|relay| {
                [3, 10002, 10063].map(|kind| {
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
        .take(8)
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
        } else if merged.len() < 8 {
            merged.push(entry);
        }
    }
    merged
}
