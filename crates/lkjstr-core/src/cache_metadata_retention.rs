//! Metadata uses the resident GDSF scorer; access hints never grant verification.
use super::reference::{self, MetadataCommit, Required};
use super::{Checkpoint, METADATA_BYTES, METADATA_EVENTS, Record};
use crate::optimizer::{
    keep_policy::KeepScorer,
    retention::{Candidate, Candidates},
};
use lkjstr_protocol::NostrEvent;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Default)]
pub struct MetadataAccess {
    /// Wall-clock minutes, shared by cache writers rather than Worker uptime.
    pub minute: u64,
    /// Only resident replaceable authors; absent follow-graph members are excluded.
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
    witnesses: BTreeSet<String>,
    recover: bool,
) -> Result<MetadataCommit, serde_json::Error> {
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
        required: vec![],
    })?
    .len();
    let protected = |entry: &Entry| {
        witnesses.contains(&entry.event.id) || access.pinned.contains(&entry.event.id)
    };
    let floor: Vec<_> = entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| protected(entry))
        .map(|(i, _)| i)
        .collect();
    let floor_bytes = floor.iter().map(|i| cost[*i] + 2).sum::<usize>();
    let overflow =
        recover && (floor.len() > METADATA_EVENTS || floor_bytes + envelope > METADATA_BYTES);
    if recover
        && (floor.len() > reference::REQUIRED_EVENTS
            || floor
                .iter()
                .map(|i| crate::cache::durable::charge(&entries[*i].row))
                .sum::<usize>()
                > reference::REQUIRED_BYTES)
    {
        return Err(reference::error("required evidence exceeds durable budget"));
    }
    let mut required = Vec::new();
    let mut references = Vec::new();
    let mut referenced = vec![false; entries.len()];
    if overflow {
        for index in floor {
            let row = &entries[index].row;
            let receipt = row
                .receipt
                .clone()
                .ok_or_else(|| reference::error("required receipt missing"))?;
            references.push(Required {
                id: row.id.clone(),
                receipt,
            });
            required.push(row.clone());
            referenced[index] = true;
        }
    }
    let reference_bytes = if references.is_empty() {
        0
    } else {
        serde_json::to_string(&references)?.len() + 12
    };
    let mut count = entries.len() - references.len();
    let mut bytes = envelope
        + reference_bytes
        + cost
            .iter()
            .enumerate()
            .filter(|(index, _)| !referenced[*index])
            .map(|(_, bytes)| bytes)
            .sum::<usize>()
        + count.saturating_sub(1) * 2;
    let mut order = Candidates::default();
    for (index, entry) in entries.iter().enumerate() {
        if !referenced[index] {
            order.push(Candidate {
                score: scores[index],
                id: entry.event.id.clone(),
                replaceable: true,
                generation: index as u64,
                bytes: cost[index],
            });
        }
    }
    let mut kept = referenced.iter().map(|value| !value).collect::<Vec<_>>();
    while let Some(candidate) = order.pop() {
        let index = candidate.generation as usize;
        if count <= METADATA_EVENTS
            && count + references.len() <= reference::REQUIRED_EVENTS
            && bytes <= METADATA_BYTES
        {
            break;
        }
        let entry = &entries[index];
        if protected(entry) {
            continue;
        }
        bytes = bytes.saturating_sub(cost[index] + usize::from(count > 1) * 2);
        count -= 1;
        kept[index] = false;
        scorer.advance(scores[index]);
    }
    if count > METADATA_EVENTS
        || count + references.len() > reference::REQUIRED_EVENTS
        || bytes > METADATA_BYTES
    {
        // Abort this cache transaction. Required evidence is never silently discarded
        // to admit optional data, and the previous valid checkpoint remains committed.
        return Err(serde_json::Error::io(std::io::Error::other(
            "required metadata exceeds cache budget; optional cache writes paused",
        )));
    }
    let mut selected: Vec<_> = entries
        .into_iter()
        .zip(kept)
        .filter_map(|(entry, keep)| keep.then_some(entry))
        .collect();
    selected.sort_by_key(|entry| std::cmp::Reverse(entry.order));
    let mut checkpoint = Checkpoint {
        version: if references.is_empty() { 1 } else { 2 },
        required: references,
        rows: Vec::with_capacity(selected.len()),
        access: Vec::with_capacity(selected.len()),
        inflation: scorer.inflation(),
    };
    for entry in selected {
        checkpoint.rows.push(entry.row);
        checkpoint.access.push(entry.stamp);
    }
    let encoded = serde_json::to_string(&checkpoint)?;
    if encoded.len() > METADATA_BYTES {
        return Err(reference::error("metadata reference budget exceeded"));
    }
    Ok(MetadataCommit { encoded, required })
}
