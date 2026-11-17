//! A bounded metadata checkpoint survives timestamp-based event pruning.
//! Updates merge in the same transaction as event writes; an older Worker
//! snapshot cannot replace a newer author/kind value.
use super::{Record, Restored};
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

pub const METADATA_KEY: &str = "verified-public-metadata-v1";
pub const METADATA_EVENTS: usize = 4000;
pub const METADATA_BYTES: usize = 4 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct Checkpoint {
    version: u8,
    rows: Vec<Record>,
}

pub fn metadata_rows(raw: Option<&str>) -> Result<Vec<Record>, &'static str> {
    let Some(raw) = raw else {
        return Ok(vec![]);
    };
    if raw.len() > METADATA_BYTES {
        return Err("metadata cache exceeds byte budget");
    }
    let data: Checkpoint = serde_json::from_str(raw).map_err(|_| "invalid metadata cache")?;
    if data.version != 1 || data.rows.len() > METADATA_EVENTS {
        return Err("unsupported metadata cache");
    }
    Ok(data.rows)
}

pub fn merge_metadata(
    previous: Option<&str>,
    incoming: &[Record],
) -> Result<String, serde_json::Error> {
    // Public cache corruption never becomes authority for a new receipt.
    let existing = metadata_rows(previous).unwrap_or_default();
    let mut slots: HashMap<(String, u64), (usize, NostrEvent, Record)> = HashMap::new();
    let mut fences = HashMap::new();
    // Rows are stored most recently observed first, independently of event age.
    for (order, row) in existing
        .into_iter()
        .rev()
        .chain(incoming.iter().cloned())
        .enumerate()
    {
        let Ok(Restored::Verified(event)) = row.restore() else {
            continue;
        };
        if event.kind == 5 {
            fences.insert(event.id.clone(), (order, event, row));
            continue;
        }
        if !lkjstr_protocol::is_replaceable_kind(event.kind) {
            continue;
        }
        let key = (event.pubkey.clone(), event.kind);
        let keep = slots.get(&key).is_none_or(|(_, old, _)| {
            event.created_at > old.created_at
                || (event.created_at == old.created_at && event.id <= old.id)
        });
        if keep {
            slots.insert(key, (order, event, row));
        }
    }
    // A stale writer cannot restore metadata after its signed deletion, even
    // once that deletion leaves the newest-event replay slice. Match the store's
    // target-and-author rule; another author's deletion has no authority.
    let deleted: HashSet<_> = fences
        .values()
        .flat_map(|(_, event, _)| {
            lkjstr_protocol::tags::tag_values(event, "e")
                .into_iter()
                .map(|id| (id, event.pubkey.clone()))
        })
        .collect();
    let mut values: Vec<_> = slots
        .into_values()
        .filter(|(_, event, _)| !deleted.contains(&(event.id.clone(), event.pubkey.clone())))
        .chain(fences.into_values())
        .collect();
    values.sort_by_key(|value| std::cmp::Reverse(value.0));
    let mut rows = Vec::new();
    // Exact serialized row sizes plus the fixed JSON envelope and separators.
    let mut bytes = serde_json::to_string(&Checkpoint {
        version: 1,
        rows: vec![],
    })?
    .len();
    for (_, _, row) in values {
        let cost = serde_json::to_string(&row)?.len() + usize::from(!rows.is_empty());
        if rows.len() >= METADATA_EVENTS {
            break;
        }
        if bytes.saturating_add(cost) <= METADATA_BYTES {
            bytes += cost;
            rows.push(row);
        }
    }
    serde_json::to_string(&Checkpoint { version: 1, rows })
}
