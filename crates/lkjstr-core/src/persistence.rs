//! Retry queue of immutable compact payload leases, never owned event clones.
use crate::store::{
    Store,
    compact::{Lease, Pool},
};
use lkjstr_protocol::NostrEvent;
use std::collections::{HashMap, HashSet, VecDeque};

/// At most 20,000 leases / 64 MiB conservatively attributed payload bytes,
/// plus one 500-pointer transaction batch. Required evidence is never displaced.
#[derive(Default)]
pub struct PendingEvents {
    events: VecDeque<Lease>,
    reserved: HashMap<crate::store::compact::Id, Lease>,
    policy: usize,
    bytes: usize,
    // Used only by standalone producers; Engine ingress shares the Store pool.
    pool: Pool,
}
const CAP: usize = 20_000;
const BATCH: usize = 500;
const BYTES: usize = 64 * 1024 * 1024;
fn policy(kind: u64) -> bool {
    matches!(kind, 0 | 3 | 5 | 10000..=19999)
}
fn admission_bytes(event: &NostrEvent) -> usize {
    let fields: usize = event.tags.iter().map(Vec::len).sum();
    crate::store::event_payload_bytes(event)
        .saturating_mul(3)
        .saturating_add(fields.saturating_mul(128))
        .saturating_add(event.tags.len().saturating_mul(8))
        .saturating_add(512)
}
impl PendingEvents {
    pub fn push(&mut self, event: NostrEvent, storage_open: bool) -> bool {
        if !storage_open || !self.can_admit(&event) {
            return false;
        }
        let Ok(lease) = self.pool.pack(event) else {
            return false;
        };
        self.push_lease(lease)
    }
    /// Distinguish impossible ingress from temporary persistence backpressure.
    pub(crate) fn can_ever_admit(event: &NostrEvent) -> bool {
        admission_bytes(event) <= BYTES
    }
    /// Backpressure before consuming verified ingress; failed storage cannot grow
    /// an unbounded queue or evict an older required policy/deletion witness.
    pub fn can_admit(&self, event: &NostrEvent) -> bool {
        self.events.len() + self.reserved.len() < CAP
            && self.bytes.saturating_add(admission_bytes(event)) <= BYTES
    }
    pub fn push_lease(&mut self, event: Lease) -> bool {
        let charge = event.managed_bytes();
        if self.events.len() + self.reserved.len() >= CAP
            || self.bytes.saturating_add(charge) > BYTES
        {
            return false;
        }
        self.policy += usize::from(policy(event.kind));
        self.bytes += charge;
        self.events.push_back(event);
        true
    }
    /// A staged own note reserves capacity without entering the persisted batch.
    pub fn reserve(&mut self, event: Lease) -> bool {
        if self.reserved.contains_key(event.id()) {
            return true;
        }
        let charge = event.managed_bytes();
        if self.events.len() + self.reserved.len() >= CAP
            || self.bytes.saturating_add(charge) > BYTES
        {
            return false;
        }
        self.bytes += charge;
        self.reserved.insert(*event.id(), event);
        true
    }
    pub fn activate(&mut self, id: &str) -> bool {
        let Some(id) = crate::store::compact::decode_id(id) else {
            return false;
        };
        let Some(event) = self.reserved.remove(&id) else {
            return false;
        };
        self.policy += usize::from(policy(event.kind));
        self.events.push_back(event);
        true
    }
    pub fn cancel_reservation(&mut self, id: &str) {
        if let Some(id) = crate::store::compact::decode_id(id) {
            self.reserved.remove(&id);
        }
        self.recount();
    }
    pub fn batch(&self) -> Vec<Lease> {
        self.events.iter().take(BATCH).cloned().collect()
    }
    pub(crate) fn discard_expired(&mut self, store: &Store) {
        self.events
            .retain(|event| !store.verified_expired(&event.id_hex()));
        self.recount();
    }
    pub fn committed(&mut self, batch: &[Lease]) {
        // Verified event IDs bind exact immutable payloads. A concurrent duplicate
        // is already durable when this same ID commits; newer revisions have new IDs.
        let ids: HashSet<_> = batch.iter().map(|event| *event.id()).collect();
        self.events.retain(|event| !ids.contains(event.id()));
        self.recount();
    }
    fn recount(&mut self) {
        self.policy = self
            .events
            .iter()
            .filter(|event| policy(event.kind))
            .count();
        self.bytes = self
            .events
            .iter()
            .chain(self.reserved.values())
            .map(|event| event.managed_bytes())
            .sum();
        self.pool.reap();
    }
    pub fn public_policy_pending(&self) -> bool {
        self.policy != 0
    }
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
    pub fn len(&self) -> usize {
        self.events.len()
    }
    /// Attributed payload pressure; shared bodies are counted once by Store's
    /// pool ledger. Queue capacity is additional managed pointer storage.
    pub fn payload_bytes(&self) -> usize {
        self.bytes
    }
    /// Queue and standalone-pool allocation plus the single bounded batch reserve.
    /// Leased Store payloads are already charged by Store and are not added again.
    pub fn overhead_bytes(&self) -> usize {
        self.queue_bytes() + self.pool.managed_bytes() + BATCH * std::mem::size_of::<Lease>()
    }
    pub fn queue_bytes(&self) -> usize {
        self.events.capacity() * std::mem::size_of::<Lease>()
            + self.reserved.capacity()
                * (std::mem::size_of::<(crate::store::compact::Id, Lease)>() + 16)
                * 2
    }
}
