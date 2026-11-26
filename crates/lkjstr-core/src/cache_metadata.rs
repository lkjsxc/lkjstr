//! A bounded metadata checkpoint retains verified evidence before event replay.
//! Verified replacement/deletion rules precede shared GDSF reuse selection.
use super::{Record, Restored};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
#[path = "cache_metadata_retention.rs"]
mod retention;
pub use retention::MetadataAccess;
use retention::{Entry, Stamp};
#[path = "cache_metadata_reference.rs"]
mod reference;
#[path = "cache_metadata_witness.rs"]
mod witness;
pub use reference::{
    MetadataCommit, Required, references as metadata_references, resolve as resolve_metadata,
};

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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    required: Vec<Required>,
}

fn checkpoint(raw: &str) -> Result<Checkpoint, &'static str> {
    if raw.len() > METADATA_BYTES {
        return Err("metadata cache exceeds byte budget");
    }
    let data: Checkpoint = serde_json::from_str(raw).map_err(|_| "invalid metadata cache")?;
    if !matches!(data.version, 1 | 2)
        || data.rows.len() > METADATA_EVENTS
        || data.required.len() + data.rows.len() > reference::REQUIRED_EVENTS
        || (data.version == 1 && !data.required.is_empty())
    {
        return Err("unsupported metadata cache");
    }
    Ok(data)
}

/// Parse the common inline checkpoint only once on ordinary warm startup.
pub fn metadata_inline(raw: Option<&str>) -> Result<Option<Vec<Record>>, &'static str> {
    let Some(data) = raw.map(checkpoint).transpose()? else {
        return Ok(Some(Vec::new()));
    };
    Ok(data.required.is_empty().then_some(data.rows))
}

pub fn metadata_rows(raw: Option<&str>) -> Result<Vec<Record>, &'static str> {
    resolve_metadata(raw, &[])
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
    let previous = previous.and_then(|raw| checkpoint(raw).ok());
    if previous
        .as_ref()
        .is_some_and(|data| !data.required.is_empty())
    {
        return Err(reference::error(
            "required metadata needs transactional resolution",
        ));
    }
    merge(previous, incoming, access, false).map(|commit| commit.encoded)
}

/// Recovery never forgets a referenced proof. Resolution is from the same
/// serialized event/checkpoint transaction, including any prior required body.
pub fn recover_metadata(
    previous: Option<&str>,
    resolved: &[Record],
    incoming: &[Record],
    access: &MetadataAccess,
) -> Result<MetadataCommit, serde_json::Error> {
    let mut existing = previous
        .map(checkpoint)
        .transpose()
        .map_err(reference::error)?;
    if let Some(data) = &mut existing {
        data.rows = resolve_metadata(previous, resolved).map_err(reference::error)?;
        data.required.clear();
    }
    merge(existing, incoming, access, true)
}

fn merge(
    existing: Option<Checkpoint>,
    incoming: &[Record],
    access: &MetadataAccess,
    recover: bool,
) -> Result<MetadataCommit, serde_json::Error> {
    // Only exact receipt-bearing public rows can establish checkpoint authority.
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
    retention::select(entries, access, inflation, witnesses, recover)
}
