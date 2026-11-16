//! Metadata and explicit receipt queries use the ordinary bounded relay scheduler.
use super::{
    Engine,
    protocol::{Filters, Query, Source},
};
use lkjstr_protocol::NostrFilter;
use std::collections::{BTreeMap, BTreeSet};
impl Engine {
    pub fn zap_receipt_relays(&self, account: &str, target: &super::zaps::Target) -> Vec<String> {
        let mut relays = self
            .account_relays(account)
            .map(|(_, rs)| {
                rs.into_iter()
                    .filter(|r| r.read)
                    .map(|r| r.url)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        relays.extend(
            self.network
                .relay_order
                .iter()
                .filter(|u| self.network.known.get(*u).is_none_or(|r| r.read))
                .cloned(),
        );
        relays.truncate(8);
        if let Ok(plan) = super::zaps::target(&self.store, target) {
            for recipient in plan.recipients {
                if let Some((_, rs)) = self.account_relays(&recipient.pubkey) {
                    relays.extend(rs.into_iter().filter(|r| r.read).take(2).map(|r| r.url));
                }
            }
        }
        let mut seen = BTreeSet::new();
        relays
            .into_iter()
            .filter(|r| seen.insert(r.clone()))
            .take(16)
            .collect()
    }
    pub(super) fn zap_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        let reads: Vec<_> = self
            .network
            .relay_order
            .iter()
            .filter(|u| self.network.known.get(*u).is_none_or(|r| r.read))
            .take(2)
            .cloned()
            .collect();
        let mut batches: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for (person, hints) in self.zaps.metadata() {
            for relay in hints.into_iter().take(2).chain(reads.iter().cloned()) {
                batches.entry(relay).or_default().insert(person.clone());
            }
        }
        let mut wants = vec![];
        for (relay, authors) in batches {
            let authors: Vec<_> = authors.into_iter().collect();
            for chunk in authors.chunks(120) {
                wants.push((
                    "@zaps:profiles".into(),
                    NostrFilter {
                        authors: Some(chunk.to_vec()),
                        kinds: Some(vec![0]),
                        limit: Some(chunk.len() as u64),
                        ..Default::default()
                    },
                    route(&relay),
                ));
            }
        }
        for chunk in self.zaps.missing_targets(&self.store).chunks(120) {
            for relay in &reads {
                wants.push((
                    "@zaps:targets".into(),
                    NostrFilter {
                        ids: Some(chunk.to_vec()),
                        limit: Some(chunk.len() as u64),
                        ..Default::default()
                    },
                    route(relay),
                ));
            }
        }
        for target in self.zaps.jobs.receipt_targets() {
            for relay in &reads {
                wants.push((
                    "@zaps:receipts".into(),
                    super::zap_runtime::receipt_filter(&target),
                    route(relay),
                ));
            }
        }
        wants
    }
}
fn route(relay: &str) -> Query {
    Query {
        source: Source::Relay,
        target: Some(relay.into()),
        filters: Filters {
            relay_hints: vec![relay.into()],
            ..Default::default()
        },
        ..Default::default()
    }
}
