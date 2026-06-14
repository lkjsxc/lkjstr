use super::content::feed_event_content_rows_with_emojis;
use super::{
    FeedEventContent, FeedEventContentRow, FeedEventUnavailablePreview, feed_event_content,
    feed_event_content_rows, plan_feed_event_content,
};
use crate::feed_fragments::{
    EventFullRow, EventIndexedRow, EventMarkerRow, EventTextSegmentRow, FeedFragmentConfig,
    FeedVisualRow, SemanticFeedEvent,
};
use lkjstr_protocol::{CustomEmoji, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT};

#[test]
fn content_rows_keep_renderable_fragments_in_order() {
    let rows = vec![
        FeedVisualRow::EventHeader(marker("event-header")),
        FeedVisualRow::EventFull(full("hello")),
        FeedVisualRow::EventTextSegment(segment(1, "world")),
        FeedVisualRow::EventMediaSegment(indexed(2)),
        FeedVisualRow::EventReferenceSegment(indexed(3)),
        FeedVisualRow::EventActions(marker("event-actions")),
    ];

    assert_eq!(
        feed_event_content_rows(&rows),
        vec![
            FeedEventContentRow::Text("hello".to_owned()),
            FeedEventContentRow::Text("world".to_owned()),
            FeedEventContentRow::MediaPreviewUnavailable(unavailable("indexed-2", 2)),
            FeedEventContentRow::ReferencePreviewUnavailable(unavailable("indexed-3", 3)),
        ]
    );
}

#[test]
fn content_warning_keeps_rows_for_local_reveal() {
    assert_eq!(
        feed_event_content(
            true,
            Some("spoiler".to_owned()),
            &[FeedVisualRow::EventFull(full("secret"))],
        ),
        FeedEventContent::Sensitive {
            reason: Some("spoiler".to_owned()),
            rows: vec![FeedEventContentRow::Text("secret".to_owned())],
        },
    );
    assert_eq!(
        feed_event_content(false, None, &[FeedVisualRow::EventFull(full("public"))]),
        FeedEventContent::Rows(vec![FeedEventContentRow::Text("public".to_owned())]),
    );
}

#[test]
fn content_rows_replace_valid_custom_emoji_tokens_with_render_rows() {
    let rows = vec![FeedVisualRow::EventFull(full("hi :party: now :party:"))];
    let emoji = CustomEmoji {
        shortcode: "party".to_owned(),
        url: "https://emoji.example/party.png".to_owned(),
        address: Some(format!("30030:{}:set", "a".repeat(64))),
    };

    assert_eq!(
        feed_event_content_rows_with_emojis(&rows, std::slice::from_ref(&emoji)),
        vec![
            FeedEventContentRow::Text("hi ".to_owned()),
            FeedEventContentRow::CustomEmoji((&emoji).into()),
            FeedEventContentRow::Text(" now ".to_owned()),
            FeedEventContentRow::CustomEmoji((&emoji).into()),
        ]
    );
}

#[test]
fn action_events_render_bounded_protocol_summary_rows() {
    assert_eq!(
        content_texts(plan_feed_event_content(
            false,
            None,
            &event(KIND_REPOST, &"{".repeat(3_000)),
            &[],
            "shape",
            120,
            &FeedFragmentConfig::default(),
        )),
        vec!["Reposted target unavailable".to_owned()]
    );
    assert_eq!(
        content_texts(plan_feed_event_content(
            false,
            None,
            &event(KIND_REACTION, "+"),
            &[],
            "shape",
            120,
            &FeedFragmentConfig::default(),
        )),
        vec!["Reacted with +".to_owned()]
    );
    assert_eq!(
        content_texts(plan_feed_event_content(
            false,
            None,
            &event(KIND_ZAP_RECEIPT, ""),
            &[],
            "shape",
            120,
            &FeedFragmentConfig::default(),
        )),
        vec!["Zap receipt target unavailable".to_owned()]
    );
}

fn content_texts(content: FeedEventContent) -> Vec<String> {
    content_rows(content)
        .into_iter()
        .map(|row| row.text())
        .collect()
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event(kind: u64, content: &str) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "event".to_owned(),
        event_kind: kind,
        pubkey: "a".repeat(64),
        created_at: 1,
        content: content.to_owned(),
        media_attachments: Vec::new(),
        media_count: 0,
        reference_count: 0,
        relay_provenance: Vec::new(),
        has_action_bar: false,
    }
}

fn full(content: &str) -> EventFullRow {
    EventFullRow {
        event_id: "event".to_owned(),
        row_key: format!("full-{content}"),
        content: content.to_owned(),
        relay_provenance: Vec::new(),
    }
}

fn marker(row_key: &str) -> EventMarkerRow {
    EventMarkerRow {
        event_id: "event".to_owned(),
        row_key: row_key.to_owned(),
        relay_provenance: Vec::new(),
    }
}

fn segment(index: u16, text: &str) -> EventTextSegmentRow {
    EventTextSegmentRow {
        event_id: "event".to_owned(),
        row_key: format!("segment-{index}"),
        segment_index: index,
        text: text.to_owned(),
        starts_at: 0,
        ends_at: text.len(),
        relay_provenance: Vec::new(),
    }
}

fn indexed(index: u16) -> EventIndexedRow {
    EventIndexedRow {
        event_id: "event".to_owned(),
        row_key: format!("indexed-{index}"),
        index,
        relay_provenance: Vec::new(),
    }
}

fn unavailable(row_key: &str, segment_index: u16) -> FeedEventUnavailablePreview {
    FeedEventUnavailablePreview {
        row_key: row_key.to_owned(),
        segment_index,
    }
}
