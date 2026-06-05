use lkjstr_app::FeedVisualRow;
use lkjstr_app::feed_fragments::{EventIndexedRow, EventMarkerRow};

use super::dto::VisualRowDto;

pub fn visual_row_to_dto(row: &FeedVisualRow) -> VisualRowDto {
    match row {
        FeedVisualRow::EventFull(value) => VisualRowDto {
            kind: "event-full".to_owned(),
            event_id: value.event_id.clone(),
            row_key: value.row_key.clone(),
            segment_index: None,
            text: Some(value.content.clone()),
            starts_at: None,
            ends_at: None,
            index: None,
            relay_provenance: value.relay_provenance.clone(),
        },
        FeedVisualRow::EventHeader(value) => marker_to_dto("event-header", value),
        FeedVisualRow::EventActions(value) => marker_to_dto("event-actions", value),
        FeedVisualRow::EventTextSegment(value) => VisualRowDto {
            kind: "event-text-segment".to_owned(),
            event_id: value.event_id.clone(),
            row_key: value.row_key.clone(),
            segment_index: Some(value.segment_index),
            text: Some(value.text.clone()),
            starts_at: Some(value.starts_at),
            ends_at: Some(value.ends_at),
            index: None,
            relay_provenance: value.relay_provenance.clone(),
        },
        FeedVisualRow::EventMediaSegment(value) => indexed_to_dto("event-media-segment", value),
        FeedVisualRow::EventReferenceSegment(value) => {
            indexed_to_dto("event-reference-segment", value)
        }
    }
}

fn marker_to_dto(kind: &str, row: &EventMarkerRow) -> VisualRowDto {
    VisualRowDto {
        kind: kind.to_owned(),
        event_id: row.event_id.clone(),
        row_key: row.row_key.clone(),
        segment_index: None,
        text: None,
        starts_at: None,
        ends_at: None,
        index: None,
        relay_provenance: row.relay_provenance.clone(),
    }
}

fn indexed_to_dto(kind: &str, row: &EventIndexedRow) -> VisualRowDto {
    VisualRowDto {
        kind: kind.to_owned(),
        event_id: row.event_id.clone(),
        row_key: row.row_key.clone(),
        segment_index: None,
        text: None,
        starts_at: None,
        ends_at: None,
        index: Some(row.index),
        relay_provenance: row.relay_provenance.clone(),
    }
}
