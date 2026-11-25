//! A bounded metadata checkpoint survives timestamp-based event pruning.
//! Verified replacement/deletion rules precede shared GDSF reuse selection.
use super::{Record, Restored};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
#[path = "cache_metadata_retention.rs"]
mod retention;
pub use retention::MetadataAccess;
use retention::{Entry, Stamp};
#[path = "cache_metadata_witness.rs"]
mod witness;

pub const METADATA_KEY: &str = "verified-public-metadata-v1";
pub const METADATA_EVENTS: usize = 4000;
pub const METADATA_BYTES: usize = 4 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct Checkpoint {
    version: u8,
    rows: Vec<Record>,
    #[serde(default)]
    access: Vec<Stamp>,
    #[serde(default)]
    inflation: u64,
}

fn checkpoint(raw: &str) -> Result<Checkpoint, &'static str> {
    if raw.len() > METADATA_BYTES {
        return Err("metadata cache exceeds byte budget");
    }
    let data: Checkpoint = serde_json::from_str(raw).map_err(|_| "invalid metadata cache")?;
    if data.version != 1 || data.rows.len() > METADATA_EVENTS {
        return Err("unsupported metadata cache");
    }
    Ok(data)
}

pub fn metadata_rows(raw: Option<&str>) -> Result<Vec<Record>, &'static str> {
    raw.map(checkpoint)
        .transpose()
        .map(|data| data.map_or_else(Vec::new, |data| data.rows))
}

pub fn merge_metadata(
    previous: Option<&str>,
    incoming: &[Record],
) -> Result<String, serde_json::Error> {
    merge_metadata_with_access(previous, incoming, &MetadataAccess::default())
}

pub fn merge_metadata_with_access(
    previous: Option<&str>,
    incoming: &[Record],
    access: &MetadataAccess,
) -> Result<String, serde_json::Error> {
    // Unverified rows and corrupt checkpoints cannot become receipt authority.
    let existing = previous.and_then(|raw| checkpoint(raw).ok());
    let inflation = existing.as_ref().map_or(0, |data| data.inflation);
    let stamps: HashMap<_, _> = existing
        .as_ref()
        .into_iter()
        .flat_map(|data| {
            data.rows
                .iter()
                .zip(&data.access)
                .map(|(row, stamp)| (row.id.clone(), *stamp))
        })
        .collect();
    let rows = existing.map_or_else(Vec::new, |data| data.rows);
    let mut slots = HashMap::new();
    let mut known = HashMap::new();
    let mut fences = HashMap::new();
    for (order, row) in rows
        .into_iter()
        .rev()
        .chain(incoming.iter().cloned())
        .enumerate()
    {
        let Ok(Restored::Verified(event)) = row.restore() else {
            continue;
        };
        let stamp = stamps.get(&row.id).copied().unwrap_or(Stamp {
            minute: access.minute,
            weight: 1,
            inflation,
        });
        let entry = Entry {
            order,
            event,
            row,
            stamp,
        };
        known.insert(entry.event.id.clone(), entry.event.pubkey.clone());
        if entry.event.kind == 5 {
            fences.insert(entry.event.id.clone(), entry);
            continue;
        }
        if !lkjstr_protocol::is_replaceable_kind(entry.event.kind) {
            continue;
        }
        let key = (entry.event.pubkey.clone(), entry.event.kind);
        let keep = slots.get(&key).is_none_or(|old: &Entry| {
            entry.event.created_at > old.event.created_at
                || (entry.event.created_at == old.event.created_at
                    && entry.event.id <= old.event.id)
        });
        if keep {
            slots.insert(key, entry);
        }
    }
    // Keep signed deletion evidence even when its target is no longer a resident row.
    // A foreign author's deletion still has no authority over the target.
    let deleted: HashSet<_> = fences
        .values()
        .flat_map(|entry| {
            lkjstr_protocol::tags::tag_values(&entry.event, "e")
                .into_iter()
                .map(|id| (id, entry.event.pubkey.clone()))
        })
        .collect();
    let witnesses = witness::select(&known, &fences);
    let entries = slots
        .into_values()
        .filter(|entry| !deleted.contains(&(entry.event.id.clone(), entry.event.pubkey.clone())))
        // Unneeded controls stay in the event cache, not in the metadata proof set.
        // Otherwise a proven foreign target could look unknown on a later write.
        .chain(
            fences
                .into_values()
                .filter(|entry| witnesses.contains(&entry.event.id)),
        )
        .collect();
    retention::select(entries, access, inflation, witnesses)
}
