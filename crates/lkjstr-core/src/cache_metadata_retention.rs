//! Metadata uses the resident GDSF scorer; access hints never grant verification.
use super::{Checkpoint, METADATA_BYTES, METADATA_EVENTS, Record};
use crate::optimizer::keep_policy::KeepScorer;
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Default)]
pub struct MetadataAccess {
    /// Wall-clock minutes, shared by cache writers rather than Worker uptime.
    pub minute: u64,
    /// Bounded by the active views and saved account follow graphs.
    pub authors: BTreeMap<String, u64>,
    /// Verified account policies and active read dependencies, never arbitrary hints.
    pub pinned: BTreeSet<String>,
}

#[derive(Clone, Copy, Default, Serialize, Deserialize)]
pub(super) struct Stamp {
    pub minute: u64,
    pub weight: u64,
    pub inflation: u64,
}

pub(super) struct Entry {
    pub order: usize,
    pub event: NostrEvent,
    pub row: Record,
    pub stamp: Stamp,
}

pub(super) fn select(
    mut entries: Vec<Entry>,
    access: &MetadataAccess,
    inflation: u64,
) -> Result<String, serde_json::Error> {
    let mut scorer = KeepScorer::default();
    scorer.advance(inflation);
    let mut cost = Vec::with_capacity(entries.len());
    let mut scores = Vec::with_capacity(entries.len());
    for entry in &mut entries {
        if let Some(weight) = access.authors.get(&entry.event.pubkey)
            && access.minute >= entry.stamp.minute
        {
            entry.stamp = Stamp {
                minute: access.minute,
                weight: *weight,
                inflation: scorer.inflation(),
            };
        }
        let bytes =
            serde_json::to_string(&entry.row)?.len() + serde_json::to_string(&entry.stamp)?.len();
        cost.push(bytes);
        scores.push(scorer.score(
            entry.stamp.inflation,
            entry.event.kind,
            entry.stamp.weight,
            access.minute.saturating_sub(entry.stamp.minute),
            1500,
            bytes,
        ));
    }
    // Reserve the maximum decimal inflation width, then account both arrays exactly.
    let envelope = serde_json::to_string(&Checkpoint {
        version: 1,
        rows: vec![],
        access: vec![],
        inflation: u64::MAX,
    })?
    .len();
    let mut count = entries.len();
    let mut bytes = envelope + cost.iter().sum::<usize>() + count.saturating_sub(1) * 2;
    let mut order: Vec<_> = (0..entries.len()).collect();
    order.sort_unstable_by(|a, b| {
        (scores[*a], &entries[*a].event.id).cmp(&(scores[*b], &entries[*b].event.id))
    });
    let mut kept = vec![true; count];
    for index in order {
        if count <= METADATA_EVENTS && bytes <= METADATA_BYTES {
            break;
        }
        let entry = &entries[index];
        if entry.event.kind == 5 || access.pinned.contains(&entry.event.id) {
            continue;
        }
        bytes = bytes.saturating_sub(cost[index] + usize::from(count > 1) * 2);
        count -= 1;
        kept[index] = false;
        scorer.advance(scores[index]);
    }
    if count > METADATA_EVENTS || bytes > METADATA_BYTES {
        // Abort this cache transaction. Required evidence is never silently discarded
        // to admit optional data, and the previous valid checkpoint remains committed.
        return Err(serde_json::Error::io(std::io::Error::other(
            "required metadata exceeds cache budget; optional admissions paused",
        )));
    }
    let mut selected: Vec<_> = entries
        .into_iter()
        .zip(kept)
        .filter_map(|(entry, keep)| keep.then_some(entry))
        .collect();
    selected.sort_by_key(|entry| std::cmp::Reverse(entry.order));
    let mut checkpoint = Checkpoint {
        version: 1,
        rows: Vec::with_capacity(selected.len()),
        access: Vec::with_capacity(selected.len()),
        inflation: scorer.inflation(),
    };
    for entry in selected {
        checkpoint.rows.push(entry.row);
        checkpoint.access.push(entry.stamp);
    }
    serde_json::to_string(&checkpoint)
}
