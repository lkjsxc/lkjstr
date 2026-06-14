use super::{
    FeedEventContent, FeedEventContentRow, FeedEventReferenceKind, FeedEventReferenceUnavailable,
    FeedEventUnavailablePreview, plan_feed_event_content,
};
use crate::feed_fragments::{FeedFragmentConfig, FeedVisualRow, SemanticFeedEvent};
use lkjstr_protocol::{EventReference, EventReferenceKind, EventReferenceSource};

#[test]
fn content_rows_append_real_reference_for_full_events() {
    let content = plan_feed_event_content(
        false,
        None,
        &event_with_references("quoted", &[reference("a", EventReferenceKind::Quote)]),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("quoted".to_owned()),
            reference_row("shape", 0, "a", FeedEventReferenceKind::Quote),
        ]
    );
}

#[test]
fn content_rows_replace_reference_segments_with_identity_rows() {
    let config = FeedFragmentConfig {
        references_per_segment: 1,
        ..FeedFragmentConfig::default()
    };
    let content = plan_feed_event_content(
        false,
        None,
        &event_with_references(
            "refs",
            &[
                reference("b", EventReferenceKind::ReplyRoot),
                reference("c", EventReferenceKind::ReplyParent),
            ],
        ),
        &[],
        "shape",
        120,
        &config,
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("refs".to_owned()),
            reference_row("shape", 0, "b", FeedEventReferenceKind::ReplyRoot),
            reference_row("shape", 1, "c", FeedEventReferenceKind::ReplyParent),
        ]
    );
}

#[test]
fn count_only_reference_segments_stay_generic_unavailable() {
    let rows = vec![FeedVisualRow::EventReferenceSegment(indexed_reference())];

    assert_eq!(
        super::feed_event_content_rows(&rows),
        vec![FeedEventContentRow::ReferencePreviewUnavailable(
            FeedEventUnavailablePreview {
                row_key: "reference-segment".to_owned(),
                segment_index: 0,
            }
        )]
    );
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event_with_references(content: &str, refs: &[EventReference]) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "event".to_owned(),
        event_kind: 1,
        pubkey: "d".repeat(64),
        created_at: 1,
        content: content.to_owned(),
        media_attachments: Vec::new(),
        event_references: refs.to_vec(),
        media_count: 0,
        reference_count: refs.len().min(usize::from(u16::MAX)) as u16,
        relay_provenance: Vec::new(),
        has_action_bar: false,
    }
}

fn reference(seed: &str, kind: EventReferenceKind) -> EventReference {
    EventReference {
        kind,
        id: seed.repeat(64),
        relays: vec!["wss://relay.example".to_owned()],
        author_pubkey: None,
        marker: None,
        source: EventReferenceSource::E,
    }
}

fn reference_row(
    shape: &str,
    index: u16,
    seed: &str,
    kind: FeedEventReferenceKind,
) -> FeedEventContentRow {
    FeedEventContentRow::ReferenceUnavailable(FeedEventReferenceUnavailable {
        row_key: format!("event:event:shape:{shape}:kind:event-reference:index:{index}"),
        segment_index: index,
        event_id: seed.repeat(64),
        kind,
        relays: vec!["wss://relay.example".to_owned()],
    })
}

fn indexed_reference() -> crate::feed_fragments::EventIndexedRow {
    crate::feed_fragments::EventIndexedRow {
        event_id: "event".to_owned(),
        row_key: "reference-segment".to_owned(),
        index: 0,
        relay_provenance: Vec::new(),
    }
}
