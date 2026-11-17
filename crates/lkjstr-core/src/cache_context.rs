//! Whole public read contexts preserve contributors, not invented aggregate counts.
use super::{Record, Restored, zaps::ReceiptRecord};
use crate::store::Store;
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

#[path = "cache_context_check.rs"]
mod check;
#[path = "cache_context_delete.rs"]
mod delete;
#[path = "cache_context_merge.rs"]
mod merge;
#[path = "cache_context_recover.rs"]
mod recover;
use check::token;
pub use merge::{merge_contexts, read_contexts};
pub use recover::recover_contexts;
pub const CONTEXT_KEY: &str = "verified-read-context-v1";
pub const CONTEXT_TARGETS: usize = 256;
pub const CONTEXT_RECORDS: usize = 8000;
pub const CONTEXT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone, Copy)]
pub struct Limits {
    pub targets: usize,
    pub records: usize,
    pub bytes: usize,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            targets: CONTEXT_TARGETS,
            records: CONTEXT_RECORDS,
            bytes: CONTEXT_BYTES,
        }
    }
}
impl Limits {
    pub(crate) fn bounded(self) -> Self {
        Self {
            targets: self.targets.min(CONTEXT_TARGETS),
            records: self.records.min(CONTEXT_RECORDS),
            bytes: self.bytes.min(CONTEXT_BYTES),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Context {
    pub target: String,
    pub author: String,
    pub seen_at: u64,
    pub lineage: String,
    pub generation: u64,
    pub rows: Vec<Record>,
    #[serde(default)]
    pub zaps: Vec<ReceiptRecord>,
    pub token: String,
}
#[derive(Serialize, Deserialize)]
struct Checkpoint {
    format: u8,
    epoch: String,
    generation: u64,
    contexts: Vec<Context>,
}
fn contributor(kind: u64) -> bool {
    matches!(kind, 1 | 5 | 6 | 7 | 16 | 42 | 9735 | 30023)
}
impl Context {
    /// Only an actual reader/near-delivered ID may call this. Store is verified.
    /// Capture the complete retained reply graph: grandchildren can affect counts.
    pub fn capture(
        store: &Store,
        target: &str,
        seen_at: u64,
    ) -> Result<Option<Self>, &'static str> {
        Self::capture_bounded(store, target, seen_at, Limits::default())
    }
    pub(crate) fn capture_bounded(
        store: &Store,
        target: &str,
        seen_at: u64,
        limits: Limits,
    ) -> Result<Option<Self>, &'static str> {
        let Some(events) = Self::events(store, target) else {
            return Ok(None);
        };
        let author = events
            .get(target)
            .ok_or("read context lost its target")?
            .pubkey
            .clone();
        if events.len() > limits.records.min(CONTEXT_RECORDS)
            || events
                .values()
                .map(|e| crate::store::event_payload_bytes(e))
                .sum::<usize>()
                > limits.bytes.min(CONTEXT_BYTES)
        {
            return Err("read context exceeds budget");
        }
        let rows = events
            .values()
            .map(|event| Record::verified(event).map_err(|_| "read context encoding failed"))
            .collect::<Result<_, _>>()?;
        Ok(Some(Self::from_rows(
            target.to_owned(),
            author,
            seen_at,
            String::new(),
            0,
            rows,
            vec![],
        )?))
    }
    /// Same retained graph as capture, without serializing or hashing every body
    /// during each row projection.
    pub(crate) fn events(
        store: &Store,
        target: &str,
    ) -> Option<BTreeMap<String, crate::store::Event>> {
        let note = store.get(target)?;
        if !matches!(note.kind, 1 | 6 | 16 | 42 | 30023) {
            return None;
        }
        let mut events = BTreeMap::from([(note.id.clone(), note.clone())]);
        for event in store
            .thread(target)
            .into_iter()
            .chain(store.referencing(target))
        {
            if event.kind != 5 && contributor(event.kind) {
                events.insert(event.id.clone(), event);
            }
        }
        Some(events)
    }
    fn from_rows(
        target: String,
        author: String,
        seen_at: u64,
        lineage: String,
        generation: u64,
        mut rows: Vec<Record>,
        mut zaps: Vec<ReceiptRecord>,
    ) -> Result<Self, &'static str> {
        rows.sort_by(|a, b| a.id.cmp(&b.id));
        rows.dedup_by(|a, b| a.id == b.id);
        zaps.sort_by(|a, b| a.id.cmp(&b.id));
        zaps.dedup_by(|a, b| a.id == b.id);
        let token = token(&target, &author, &lineage, generation, &rows, &zaps)?;
        Ok(Self {
            target,
            author,
            seen_at,
            lineage,
            generation,
            rows,
            zaps,
            token,
        })
    }
    pub(crate) fn set_records(
        &mut self,
        rows: Vec<Record>,
        zaps: Vec<ReceiptRecord>,
    ) -> Result<(), &'static str> {
        let next = Self::from_rows(
            self.target.clone(),
            self.author.clone(),
            self.seen_at,
            self.lineage.clone(),
            self.generation,
            rows,
            zaps,
        )?;
        if next.rows.len() > CONTEXT_RECORDS
            || serde_json::to_vec(&next)
                .map_err(|_| "read context encoding failed")?
                .len()
                > CONTEXT_BYTES
        {
            return Err("read context exceeds budget");
        }
        *self = next;
        Ok(())
    }
}
