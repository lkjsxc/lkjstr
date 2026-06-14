use super::{
    FeedEventContent, FeedEventContentRow, FeedEventMediaAttachment, FeedEventMediaKind,
    plan_feed_event_content,
};
use crate::feed_fragments::{FeedFragmentConfig, SemanticFeedEvent};
use lkjstr_protocol::{ContentAttachment, ContentAttachmentKind, KIND_REPOST};

#[test]
fn content_rows_append_real_media_for_full_events() {
    let content = plan_feed_event_content(
        false,
        None,
        &event_with_media("image", &[media("https://cdn.example/image.png")]),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("image".to_owned()),
            media_row("shape", 0, "https://cdn.example/image.png"),
        ]
    );
}

#[test]
fn content_rows_replace_media_segments_with_real_attachment_rows() {
    let config = FeedFragmentConfig {
        media_items_per_segment: 2,
        ..FeedFragmentConfig::default()
    };
    let content = plan_feed_event_content(
        false,
        None,
        &event_with_media(
            "image",
            &[
                media("https://cdn.example/one.png"),
                media("https://cdn.example/two.png"),
                media("https://cdn.example/three.png"),
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
            FeedEventContentRow::Text("image".to_owned()),
            media_row("shape", 0, "https://cdn.example/one.png"),
            media_row("shape", 1, "https://cdn.example/two.png"),
            media_row("shape", 2, "https://cdn.example/three.png"),
        ]
    );
}

#[test]
fn action_summaries_do_not_inherit_raw_media_rows() {
    let mut event = event_with_media(
        "https://cdn.example/raw.png",
        &[media("https://cdn.example/raw.png")],
    );
    event.event_kind = KIND_REPOST;

    assert_eq!(
        content_rows(plan_feed_event_content(
            false,
            None,
            &event,
            &[],
            "shape",
            120,
            &FeedFragmentConfig::default(),
        )),
        vec![FeedEventContentRow::Text(
            "Reposted target unavailable".to_owned()
        )]
    );
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event_with_media(content: &str, attachments: &[ContentAttachment]) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "event".to_owned(),
        event_kind: 1,
        pubkey: "a".repeat(64),
        created_at: 1,
        content: content.to_owned(),
        media_attachments: attachments.to_vec(),
        event_references: Vec::new(),
        media_count: attachments.len().min(usize::from(u16::MAX)) as u16,
        reference_count: 0,
        relay_provenance: Vec::new(),
        has_action_bar: false,
    }
}

fn media(url: &str) -> ContentAttachment {
    ContentAttachment {
        url: url.to_owned(),
        kind: ContentAttachmentKind::Image,
        aspect_ratio: Some("4 / 3".to_owned()),
    }
}

fn media_row(shape: &str, index: u16, url: &str) -> FeedEventContentRow {
    FeedEventContentRow::MediaAttachment(FeedEventMediaAttachment {
        row_key: format!("event:event:shape:{shape}:kind:event-media-attachment:index:{index}"),
        item_index: index,
        url: url.to_owned(),
        kind: FeedEventMediaKind::Image,
        aspect_ratio: Some("4 / 3".to_owned()),
    })
}
