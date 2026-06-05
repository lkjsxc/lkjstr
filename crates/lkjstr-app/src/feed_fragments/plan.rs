use super::keys::fragment_key;
use super::model::{
    EventFullRow, EventIndexedRow, EventMarkerRow, EventTextSegmentRow, FeedFragmentConfig,
    FeedVisualRow, SemanticFeedEvent,
};
use super::text::split_text_segments;

#[must_use]
pub fn plan_feed_visual_rows(
    event: &SemanticFeedEvent,
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> Vec<FeedVisualRow> {
    if should_render_full(event, estimated_height_px, config) {
        return vec![FeedVisualRow::EventFull(EventFullRow {
            event_id: event.event_id.clone(),
            row_key: fragment_key(&event.event_id, content_shape_hash, "event-full", 0),
            content: event.content.clone(),
            relay_provenance: event.relay_provenance.clone(),
        })];
    }
    let mut rows = Vec::new();
    push_marker(&mut rows, event, content_shape_hash, "event-header", true);
    push_text_segments(&mut rows, event, content_shape_hash, config);
    push_indexed_segments(
        &mut rows,
        event,
        content_shape_hash,
        "event-media-segment",
        event.media_count,
        config.media_items_per_segment.max(1),
        true,
    );
    push_indexed_segments(
        &mut rows,
        event,
        content_shape_hash,
        "event-reference-segment",
        event.reference_count,
        config.references_per_segment.max(1),
        false,
    );
    if event.has_action_bar {
        push_marker(&mut rows, event, content_shape_hash, "event-actions", false);
    }
    rows
}

fn should_render_full(
    event: &SemanticFeedEvent,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> bool {
    estimated_height_px < config.oversize_estimated_height_px
        && event.media_count <= config.media_items_per_segment
        && event.reference_count <= config.references_per_segment
}

fn push_marker(
    rows: &mut Vec<FeedVisualRow>,
    event: &SemanticFeedEvent,
    shape: &str,
    kind: &str,
    header: bool,
) {
    let row = EventMarkerRow {
        event_id: event.event_id.clone(),
        row_key: fragment_key(&event.event_id, shape, kind, 0),
        relay_provenance: event.relay_provenance.clone(),
    };
    if header {
        rows.push(FeedVisualRow::EventHeader(row));
    } else {
        rows.push(FeedVisualRow::EventActions(row));
    }
}

fn push_text_segments(
    rows: &mut Vec<FeedVisualRow>,
    event: &SemanticFeedEvent,
    shape: &str,
    config: &FeedFragmentConfig,
) {
    for (index, segment) in split_text_segments(
        &event.content,
        config.text_segment_target_chars,
        config.text_segment_max_chars,
    )
    .into_iter()
    .enumerate()
    {
        let segment_index = index.min(usize::from(u16::MAX)) as u16;
        rows.push(FeedVisualRow::EventTextSegment(EventTextSegmentRow {
            event_id: event.event_id.clone(),
            row_key: fragment_key(&event.event_id, shape, "event-text-segment", segment_index),
            segment_index,
            text: segment.text,
            starts_at: segment.starts_at,
            ends_at: segment.ends_at,
            relay_provenance: event.relay_provenance.clone(),
        }));
    }
}

fn push_indexed_segments(
    rows: &mut Vec<FeedVisualRow>,
    event: &SemanticFeedEvent,
    shape: &str,
    kind: &str,
    count: u16,
    per_segment: u16,
    media: bool,
) {
    for index in 0..segment_count(count, per_segment) {
        let row = EventIndexedRow {
            event_id: event.event_id.clone(),
            row_key: fragment_key(&event.event_id, shape, kind, index),
            index,
            relay_provenance: event.relay_provenance.clone(),
        };
        if media {
            rows.push(FeedVisualRow::EventMediaSegment(row));
        } else {
            rows.push(FeedVisualRow::EventReferenceSegment(row));
        }
    }
}

fn segment_count(count: u16, per_segment: u16) -> u16 {
    let per = per_segment.max(1);
    count.saturating_add(per.saturating_sub(1)) / per
}
