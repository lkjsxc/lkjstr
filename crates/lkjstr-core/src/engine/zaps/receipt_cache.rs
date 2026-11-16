//! One bounded validated view serves note totals, notification actors and unread marks.
use super::{
    Failure, IdentityProof, Phase, Provider, Providers, Result, Target, TrustedReceipt, receipt,
};
use crate::store::Store;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Weak};
#[path = "receipt_evidence.rs"]
mod evidence;
#[path = "receipt_cache_list.rs"]
mod list;
pub use evidence::Evidence;
#[path = "receipt_index.rs"]
mod index;
#[path = "receipt_cache_read.rs"]
mod read;
#[path = "receipt_schedule.rs"]
mod schedule;
#[path = "receipt_cache_sync.rs"]
mod sync;
#[path = "receipt_total.rs"]
mod total;
#[path = "receipt_validate.rs"]
mod validate;

/// The default Store retains at most 16,000 regular events. Each cached receipt
/// stores compact proof fields; comments remain only in the existing raw event.
pub const MAX_RECEIPTS: usize = 20_000;
/// Preserve prior successful authorization without unbounded provider rotations.
pub const MAX_HISTORICAL_IDENTITIES: usize = 2048;
type PaymentKey = (String, String, String);
type Member = (u64, String);
struct Checked {
    attempt: Weak<Provider>,
    result: Result<TrustedReceipt>,
    retry_capacity: bool,
    at: u64,
}
struct Entry {
    recipient: Option<String>,
    target: Option<Target>,
    checked: Option<Checked>,
    queued: Option<u64>,
}
impl Entry {
    fn new(raw: &lkjstr_protocol::NostrEvent) -> Self {
        let unique = |name| {
            lkjstr_nips::event::unique(&raw.tags, name)
                .ok()
                .flatten()
                .filter(|s| lkjstr_nips::unhex::<32>(s).is_ok())
                .map(str::to_owned)
        };
        let recipient = unique("p");
        let target = unique("e")
            .map(|id| Target::Event { id })
            .or_else(|| recipient.clone().map(|pubkey| Target::Profile { pubkey }));
        Self {
            recipient,
            target,
            checked: None,
            queued: None,
        }
    }
}
#[derive(Default)]
struct TargetIndex {
    ids: BTreeSet<String>,
    queued: BTreeSet<u64>,
}
#[derive(Default)]
pub struct Receipts {
    entries: BTreeMap<String, Entry>,
    index: BTreeMap<Target, TargetIndex>, // one target/id/queue membership per retained receipt
    last_target: Option<Target>,
    last_urgent: Option<Target>,
    groups: BTreeMap<PaymentKey, BTreeSet<Member>>,
    identities: BTreeSet<Arc<IdentityProof>>,
    queue: BTreeMap<u64, String>,
    serial: u64,
    revision: u64,
}
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Total {
    /// Exact integer decimal string; avoids JavaScript rounding.
    pub amount_msat: String,
    /// Existing numeric count, rounded down once after summing millisatoshis.
    pub sats: u64,
    pub receipts: usize,
    pub unverified: usize,
    pub phase: Phase,
    /// Numeric sats required fractional rounding or reached the JavaScript integer cap.
    pub limited: bool,
}
impl Receipts {
    pub fn revision(&self) -> u64 {
        self.revision
    }
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    pub(crate) fn target_pending(&self, target: &Target) -> bool {
        self.index.get(target).is_some_and(|i| !i.queued.is_empty())
    }
    pub fn pending(&self) -> usize {
        self.queue.len()
    }
    fn detach(&mut self, id: &str) {
        let Some(checked) = self.entries.get(id).and_then(|e| e.checked.as_ref()) else {
            return;
        };
        let Ok(value) = &checked.result else {
            return;
        };
        let key = value.payment_key();
        if let Some(group) = self.groups.get_mut(&key) {
            group.remove(&(value.created_at, value.id.clone()));
            if group.is_empty() {
                self.groups.remove(&key);
            }
        }
    }
    fn attach(&mut self, id: &str) {
        let Some(checked) = self.entries.get(id).and_then(|e| e.checked.as_ref()) else {
            return;
        };
        if let Ok(value) = &checked.result {
            self.groups
                .entry(value.payment_key())
                .or_default()
                .insert((value.created_at, value.id.clone()));
        }
    }
    fn queue(&mut self, id: &str) -> Result<()> {
        let Some(entry) = self.entries.get_mut(id) else {
            return Ok(());
        };
        if entry.queued.is_none() {
            self.serial = self.serial.checked_add(1).ok_or(Failure::TooLarge)?;
            entry.queued = Some(self.serial);
            self.queue.insert(self.serial, id.to_owned());
            if let Some(target) = &entry.target {
                self.index
                    .entry(target.clone())
                    .or_default()
                    .queued
                    .insert(self.serial);
            }
        }
        Ok(())
    }
}
