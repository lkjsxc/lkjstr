use crate::feed_fragments::fragment_key;
use lkjstr_protocol::{EventReference, EventReferenceKind as ProtocolReferenceKind};

use super::{FeedEventContentRow, FeedEventReferenceKind, FeedEventReferenceUnavailable};

#[must_use]
pub fn inject_reference_rows(
    rows: Vec<FeedEventContentRow>,
    event_id: &str,
    shape: &str,
    references: &[EventReference],
    per_segment: u16,
) -> Vec<FeedEventContentRow> {
    let reference_rows = reference_rows(event_id, shape, references);
    if reference_rows.is_empty() {
        return rows;
    }
    let mut inserted = false;
    let mut next = Vec::new();
    for row in rows {
        match row {
            FeedEventContentRow::ReferencePreviewUnavailable(preview) => {
                inserted = true;
                next.extend(segment_rows(
                    &reference_rows,
                    preview.segment_index,
                    per_segment,
                ));
            }
            other => next.push(other),
        }
    }
    if !inserted {
        next.extend(reference_rows);
    }
    next
}

fn reference_rows(
    event_id: &str,
    shape: &str,
    references: &[EventReference],
) -> Vec<FeedEventContentRow> {
    references
        .iter()
        .enumerate()
        .map(|(index, item)| reference_row(event_id, shape, index, item))
        .collect()
}

fn reference_row(
    event_id: &str,
    shape: &str,
    index: usize,
    item: &EventReference,
) -> FeedEventContentRow {
    let item_index = index.min(usize::from(u16::MAX)) as u16;
    FeedEventContentRow::ReferenceUnavailable(FeedEventReferenceUnavailable {
        row_key: fragment_key(event_id, shape, "event-reference", item_index),
        segment_index: item_index,
        event_id: item.id.clone(),
        kind: reference_kind(&item.kind),
        relays: item.relays.clone(),
    })
}

fn reference_kind(kind: &ProtocolReferenceKind) -> FeedEventReferenceKind {
    match kind {
        ProtocolReferenceKind::ReplyRoot => FeedEventReferenceKind::ReplyRoot,
        ProtocolReferenceKind::ReplyParent => FeedEventReferenceKind::ReplyParent,
        ProtocolReferenceKind::Quote => FeedEventReferenceKind::Quote,
        ProtocolReferenceKind::Repost => FeedEventReferenceKind::Repost,
        ProtocolReferenceKind::Reaction => FeedEventReferenceKind::Reaction,
        ProtocolReferenceKind::Deletion => FeedEventReferenceKind::Deletion,
        ProtocolReferenceKind::NostrEvent => FeedEventReferenceKind::NostrEvent,
    }
}

fn segment_rows(
    rows: &[FeedEventContentRow],
    segment_index: u16,
    per_segment: u16,
) -> Vec<FeedEventContentRow> {
    let start = usize::from(segment_index) * usize::from(per_segment.max(1));
    rows.iter()
        .skip(start)
        .take(usize::from(per_segment.max(1)))
        .cloned()
        .collect()
}
