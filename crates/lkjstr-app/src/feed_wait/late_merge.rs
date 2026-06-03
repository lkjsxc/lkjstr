use std::collections::BTreeMap;

use super::scroll_anchor::{ScrollAnchor, ScrollAnchorDecision, scroll_anchor_for_late_insert};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedWaitEventRow {
    pub event_id: String,
    pub created_at: u64,
    pub generation: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LateMergeResult {
    pub rows: Vec<FeedWaitEventRow>,
    pub anchor: ScrollAnchorDecision,
}

#[must_use]
pub fn merge_late_event_rows(
    current: &[FeedWaitEventRow],
    late: &[FeedWaitEventRow],
    anchor: &ScrollAnchor,
    current_generation: u64,
) -> LateMergeResult {
    let newest_before = current.first().map(|row| row.created_at).unwrap_or(0);
    let mut by_id = current
        .iter()
        .cloned()
        .map(|row| (row.event_id.clone(), row))
        .collect::<BTreeMap<_, _>>();
    for row in late
        .iter()
        .filter(|row| row.generation == current_generation)
        .cloned()
    {
        by_id.entry(row.event_id.clone()).or_insert(row);
    }
    let mut rows = by_id.into_values().collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        right
            .created_at
            .cmp(&left.created_at)
            .then_with(|| left.event_id.cmp(&right.event_id))
    });
    let inserted_above = rows
        .first()
        .map(|row| row.created_at > newest_before)
        .unwrap_or(false);
    LateMergeResult {
        rows,
        anchor: scroll_anchor_for_late_insert(anchor, inserted_above),
    }
}
