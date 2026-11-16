//! Persisted exceptions to the ordinary notification timestamp. Failed provider
//! lookup never blocks ordinary Seen, and later authorization cannot erase a claim.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
pub const MAX_DEFERRED: usize = 6000;
pub const MAX_ACKNOWLEDGED: usize = 6000;
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ReadState {
    deferred: BTreeSet<String>,
    // Oldest first; retained after Seen so canonical receipt eviction cannot revive unread.
    acknowledged: Vec<String>,
    pub limited: bool,
}
#[derive(Default)]
pub struct ReadSnapshot {
    pub pending: BTreeSet<String>,
    /// Raw receipt id -> provider/recipient/payment hash for every retained verdict.
    pub payments: BTreeMap<String, String>,
    pub acknowledged: BTreeSet<String>,
    pub invalid: BTreeSet<String>,
}
impl ReadState {
    pub fn deferred(&self) -> impl Iterator<Item = &str> {
        self.deferred.iter().take(MAX_DEFERRED).map(String::as_str)
    }
    pub fn pending(&self, id: &str) -> bool {
        self.limited || self.deferred.contains(id)
    }
    pub fn is_unread(
        &self,
        id: &str,
        payment: &str,
        aliases: &BTreeSet<String>,
        ordinary: bool,
    ) -> bool {
        if self.acknowledged.iter().any(|key| key == payment) {
            return false;
        }
        self.limited || ordinary || self.deferred.contains(id) || aliases.contains(payment)
    }
    /// Restore normalization never rejects the surrounding saved account/key data.
    pub fn normalize(&mut self) {
        self.deferred
            .retain(|id| lkjstr_nips::unhex::<32>(id).is_ok());
        if self.deferred.len() > MAX_DEFERRED {
            self.limited = true;
            while self.deferred.len() > MAX_DEFERRED {
                self.deferred.pop_last();
            }
        }
        if self.acknowledged.len() > MAX_ACKNOWLEDGED {
            self.limited = true;
            self.acknowledged
                .drain(..self.acknowledged.len() - MAX_ACKNOWLEDGED);
        }
    }
    pub fn acknowledge(&mut self, snapshot: ReadSnapshot) {
        self.normalize();
        // Clear all aliases of the logical zap, not only today's canonical raw id.
        self.deferred.retain(|id| {
            !snapshot.invalid.contains(id)
                && !snapshot
                    .payments
                    .get(id)
                    .is_some_and(|key| snapshot.acknowledged.contains(key))
        });
        for id in snapshot.pending {
            if self.deferred.contains(&id) {
                continue;
            }
            if self.deferred.len() < MAX_DEFERRED {
                self.deferred.insert(id);
            } else {
                self.limited = true;
            }
        }
        for payment in snapshot.acknowledged {
            self.acknowledged.retain(|key| key != &payment);
            if self.acknowledged.len() == MAX_ACKNOWLEDGED {
                self.acknowledged.remove(0);
                self.limited = true;
            }
            self.acknowledged.push(payment);
        }
    }
}
