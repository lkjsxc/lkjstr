//! One account-scoped policy for bounded choices. Never changes feed chronology.
use super::settings::{PrivateLists, list_has};
use crate::store::{Query, Store};
use std::collections::BTreeMap;
pub struct Weights<'a> {
    store: &'a Store,
    private: &'a PrivateLists,
    account: Option<&'a str>,
    // At most 12000 graph entries, 2000 interaction targets and the account.
    scores: BTreeMap<String, u64>,
}
impl<'a> Weights<'a> {
    pub fn new(store: &'a Store, private: &'a PrivateLists, account: Option<&'a str>) -> Self {
        let mut scores = BTreeMap::<String, u64>::new();
        if let Some(account) = account {
            let follows = store.follows(account).unwrap_or_default();
            for person in follows.iter().take(6000) {
                scores.insert(person.clone(), 32);
            }
            for person in follows.iter().take(6000) {
                if scores.len() >= 12000 {
                    break;
                }
                if let Some(list) = store.follows(person) {
                    for p in list.into_iter().take(6000) {
                        if scores.len() >= 12000 {
                            break;
                        }
                        scores.entry(p).or_insert(8);
                    }
                }
            }
            for event in store.feed(&Query {
                authors: Some([account.to_owned()].into()),
                kinds: vec![1, 42, 7],
                limit: 2000,
                ..Default::default()
            }) {
                let target = if event.kind == 7 {
                    lkjstr_protocol::tags::tag_values(&event, "e")
                        .last()
                        .cloned()
                } else {
                    lkjstr_protocol::reply_parent(&event)
                };
                // Trust a retained verified target, never an unvalidated p-tag claim.
                if let Some(target) = target.and_then(|id| store.get(&id)) {
                    let score = scores.entry(target.pubkey.clone()).or_default();
                    *score = (*score).max(16);
                }
            }
            scores.insert(account.to_owned(), 64);
        }
        Self {
            store,
            private,
            account,
            scores,
        }
    }
    pub fn person(&self, person: &str) -> u64 {
        if list_has(self.store, self.private, self.account, 10000, "p", person) {
            0
        } else {
            self.scores.get(person).copied().unwrap_or(1)
        }
    }
    pub fn event(&self, event: &lkjstr_protocol::NostrEvent) -> u64 {
        let query = super::protocol::Query {
            account: self.account.map(str::to_owned),
            ..Default::default()
        };
        if super::query::hidden_with_lists(self.store, &query, event, self.private).is_some() {
            0
        } else {
            self.person(&event.pubkey)
        }
    }
}
