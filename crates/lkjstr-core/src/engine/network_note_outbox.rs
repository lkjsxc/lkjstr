//! A retry retains the signed kind-1 event until a relay accepts or delivery ends.
use super::*;
use crate::engine::{protocol::Delivery, publication_plan::Destination};
use serde::{Deserialize, Serialize};
#[path = "network_note_checkpoint.rs"]
mod checkpoint;
pub use checkpoint::{Checkpoint, merge};
#[path = "network_note_retry.rs"]
mod retry;
#[cfg(test)]
#[path = "network_note_outbox_test.rs"]
mod tests;

const MAX_PENDING: usize = 64;
const MAX_SETTLED: usize = 64;
const MAX_BYTES: usize = 12 * 1024 * 1024;

pub fn storage_key(account: &str) -> String {
    format!("note-outbox:{account}")
}

pub fn valid_key(key: &str) -> bool {
    key.len() == 36 && key.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Sending,
    Retrying,
    Sent,
    Refused,
    Discarded,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Status {
    pub key: String,
    pub id: String,
    pub phase: Phase,
    pub attempts: u32,
    pub deliveries: Vec<Delivery>,
}

#[derive(Serialize, Deserialize)]
struct Entry {
    status: Status,
    account: String,
    changed: u64,
    event: Option<NostrEvent>,
    routes: Vec<Destination>,
    hard: BTreeMap<String, Delivery>,
    #[serde(skip)]
    ready_at: u64,
    #[serde(skip)]
    checkpoint: u64,
    #[serde(skip)]
    dirty: u64,
    #[serde(skip)]
    restored: bool,
    #[serde(skip)]
    bytes: usize,
}

/// At most 64 signed notes (12 MiB serialized) and the last 64 settled statuses.
#[derive(Default)]
pub struct NoteOutbox {
    pub enabled: bool,
    entries: BTreeMap<String, Entry>,
    revision: u64,
    committed: u64,
}

impl NoteOutbox {
    pub(in crate::engine) fn admit(&self, event: &NostrEvent) -> bool {
        !self.enabled
            || (self.entries.len() < MAX_PENDING + MAX_SETTLED
                && self.entries.values().filter(|e| e.event.is_some()).count() < MAX_PENDING
                && self.bytes() + encoded_len(event) < MAX_BYTES)
    }

    fn bytes(&self) -> usize {
        self.entries.values().map(|e| e.bytes).sum()
    }

    pub(in crate::engine) fn stage(
        &mut self,
        event: &NostrEvent,
        key: Option<String>,
        routes: &[Destination],
        now: u64,
    ) {
        if !self.enabled {
            return;
        }
        self.revision += 1;
        self.entries.insert(
            event.id.clone(),
            Entry {
                status: Status {
                    key: key.unwrap_or_else(|| event.id.clone()),
                    id: event.id.clone(),
                    phase: Phase::Sending,
                    attempts: 1,
                    deliveries: vec![],
                },
                account: event.pubkey.clone(),
                changed: now,
                event: Some(event.clone()),
                routes: routes
                    .iter()
                    .filter(|d| d.state == "pending")
                    .cloned()
                    .collect(),
                hard: BTreeMap::new(),
                ready_at: 0,
                checkpoint: self.revision,
                dirty: self.revision,
                restored: false,
                bytes: encoded_len(event),
            },
        );
    }

    pub fn pending(&self, id: &str) -> bool {
        self.entries.get(id).is_some_and(|e| e.event.is_some())
    }

    pub(in crate::engine) fn needs_checkpoint(&self, id: &str) -> bool {
        self.entries
            .get(id)
            .is_some_and(|e| e.checkpoint > self.committed)
    }

    pub fn known(&self, account: &str, key: &str) -> bool {
        self.entries
            .values()
            .any(|e| e.account == account && e.status.key == key)
    }

    pub fn statuses(&self, keys: &[String]) -> Vec<Status> {
        self.entries
            .values()
            .filter(|e| keys.contains(&e.status.key))
            .map(|e| {
                let mut status = e.status.clone();
                if e.checkpoint > self.committed && status.phase == Phase::Discarded {
                    status.phase = Phase::Retrying;
                }
                status
            })
            .collect()
    }

    fn settle(&mut self, id: &str, phase: Phase, deliveries: Vec<Delivery>, now: u64) {
        let Some(e) = self.entries.get_mut(id).filter(|e| e.event.is_some()) else {
            return;
        };
        self.revision += 1;
        e.status.phase = phase;
        e.checkpoint = self.revision;
        e.dirty = self.revision;
        e.status.deliveries = deliveries;
        e.event = None;
        e.bytes = 0;
        e.routes.clear();
        e.hard.clear();
        e.changed = now;
    }

    pub(in crate::engine) fn accepted(&mut self, id: &str, deliveries: &[Delivery], now: u64) {
        if deliveries.iter().any(|d| d.state == "accepted") {
            self.settle(id, Phase::Sent, deliveries.to_vec(), now);
        }
    }

    pub(in crate::engine) fn finished(
        &mut self,
        id: &str,
        deliveries: &[Delivery],
        all_routes: &[Delivery],
        now: u64,
    ) {
        self.accepted(id, deliveries, now);
        let Some(e) = self.entries.get_mut(id).filter(|e| e.event.is_some()) else {
            return;
        };
        for d in deliveries.iter().filter(|d| permanent(d).is_some()) {
            e.hard.insert(d.relay.clone(), d.clone());
        }
        let no_retryable_route = !all_routes.is_empty()
            && all_routes
                .iter()
                .all(|d| d.state == "skipped" || e.hard.contains_key(&d.relay));
        if e.hard.values().any(|d| permanent(d) == Some("invalid"))
            || (!e.hard.is_empty() && no_retryable_route)
        {
            let hard = e.hard.values().cloned().collect();
            self.settle(id, Phase::Refused, hard, now);
            return;
        }
        e.ready_at = now.saturating_add(delay(id, e.status.attempts));
        e.status.phase = Phase::Retrying;
        e.status.deliveries = deliveries.to_vec();
        self.revision += 1;
        e.dirty = self.revision;
    }

    pub(in crate::engine) fn discard_id(&mut self, id: &str, now: u64) {
        self.settle(id, Phase::Discarded, vec![], now);
    }

    pub fn discard(&mut self, key: &str, now: u64) -> Option<String> {
        let id = self
            .entries
            .values()
            .find(|e| e.status.key == key && e.event.is_some())?
            .status
            .id
            .clone();
        self.settle(&id, Phase::Discarded, vec![], now);
        Some(id)
    }

    pub fn pending_ids(&self, account: &str) -> Vec<String> {
        self.entries
            .values()
            .filter(|e| e.account == account && e.event.is_some())
            .map(|e| e.status.id.clone())
            .collect()
    }

    pub fn forget(&mut self, account: &str) {
        self.entries.retain(|_, e| e.account != account);
    }
}

fn encoded_len(event: &NostrEvent) -> usize {
    serde_json::to_vec(event).map_or(MAX_BYTES, |bytes| bytes.len())
}

pub(in crate::engine) fn permanent(delivery: &Delivery) -> Option<&str> {
    (delivery.state == "rejected").then_some(())?;
    let (prefix, _) = delivery.message.as_deref()?.split_once(':')?;
    matches!(prefix, "invalid" | "blocked" | "pow" | "restricted").then_some(prefix)
}

fn delay(id: &str, attempts: u32) -> u64 {
    let jitter = u64::from_str_radix(&id[..4], 16).unwrap_or(0) % 501;
    (2_000 << attempts.saturating_sub(1).min(5)).min(59_500) + jitter
}
