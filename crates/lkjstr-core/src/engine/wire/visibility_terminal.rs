//! Substitute terminal evidence in previously admitted timeline slots.
use super::note;
use crate::engine::{Engine, visibility::Reason};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

fn terminal(engine: &Engine, id: &str) -> Option<Reason> {
    if engine.store.verified_deleted(id) {
        Some(Reason::Deleted)
    } else if engine.store.verified_expired(id) {
        Some(Reason::Expired)
    } else {
        None
    }
}

/// A previously admitted slot supplies its verified identity and position. The
/// fence supplies the terminal reason. Neither can establish both on its own.
pub(super) fn retain_terminal(
    previous: &[Value],
    next: &mut Vec<Value>,
    engine: &Engine,
    anchor: Option<&str>,
    update: bool,
    keep_reading_time: bool,
) {
    let positions: BTreeMap<_, _> = next
        .iter()
        .enumerate()
        .filter_map(|(index, row)| Some((row["key"].as_str()?, index)))
        .collect();
    let mut prior_position = None;
    let predecessors: Vec<_> = previous
        .iter()
        .map(|row| {
            let preceding = prior_position;
            if row["kind"] == "note"
                && let Some(at) = row["key"].as_str().and_then(|key| positions.get(key))
            {
                prior_position = Some(*at + 1);
            }
            preceding
        })
        .collect();
    let mut successor = None;
    let mut inserts = BTreeMap::<usize, Vec<Value>>::new();
    let mut seen = BTreeSet::new();
    let overlapping = previous.iter().any(|row| {
        row["kind"] == "note"
            && row["key"]
                .as_str()
                .is_some_and(|key| positions.contains_key(key))
    });
    for (row, preceding) in previous.iter().zip(predecessors).rev() {
        let Some(key) = row["key"].as_str() else {
            continue;
        };
        if let Some(position) = positions.get(key) {
            if row["kind"] == "note" {
                successor = Some(*position);
            }
            continue;
        }
        if row["kind"] != "note"
            || (!update && !overlapping && anchor != Some(key))
            || !seen.insert(key)
        {
            continue;
        }
        let Some(reason) = row["id"].as_str().and_then(|id| terminal(engine, id)) else {
            continue;
        };
        let before = successor.or(preceding).unwrap_or(next.len());
        let mut covered = note::covered(row.clone(), reason);
        // The same retained slot can survive a move from an absolute window to an ordinary one.
        if !keep_reading_time && let Some(fields) = covered.as_object_mut() {
            fields.remove("readingAt");
        }
        inserts.entry(before).or_default().push(covered);
    }
    if inserts.is_empty() {
        return;
    }
    let rows = std::mem::take(next);
    let tail = inserts.remove(&rows.len());
    for (position, row) in rows.into_iter().enumerate() {
        if let Some(at) = inserts.remove(&position) {
            next.extend(at.into_iter().rev());
        }
        next.push(row);
    }
    if let Some(tail) = tail {
        next.extend(tail.into_iter().rev());
    }
    next.truncate(crate::engine::windows::HEAD_ROWS + 1);
}
