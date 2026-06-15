use super::{
    FeedEventContent, FeedEventContentRow, FeedEventLink, FeedEventMediaAttachment,
    FeedEventMediaKind, plan_feed_event_content,
};
use crate::feed_fragments::{FeedFragmentConfig, SemanticFeedEvent};
use lkjstr_protocol::{ContentAttachment, ContentAttachmentKind};

#[test]
fn content_rows_render_safe_https_links_with_punctuation() {
    let content = plan_feed_event_content(
        false,
        None,
        &event("see https://example.com/page, ok", &[]),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("see ".to_owned()),
            link_row("shape", 0, "https://example.com/page"),
            FeedEventContentRow::Text(", ok".to_owned()),
        ]
    );
}

#[test]
fn content_rows_hide_embedded_media_urls_inline() {
    let content = plan_feed_event_content(
        false,
        None,
        &event(
            "see https://cdn.example/image.png and",
            &[media("https://cdn.example/image.png")],
        ),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("see  and".to_owned()),
            media_row("shape", 0, "https://cdn.example/image.png"),
        ]
    );
}

#[test]
fn content_rows_keep_media_like_url_visible_without_real_attachment() {
    let content = plan_feed_event_content(
        false,
        None,
        &event("see https://cdn.example/image.png", &[]),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("see ".to_owned()),
            link_row("shape", 0, "https://cdn.example/image.png"),
        ]
    );
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event(content: &str, attachments: &[ContentAttachment]) -> SemanticFeedEvent {
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

fn link_row(shape: &str, index: u16, url: &str) -> FeedEventContentRow {
    FeedEventContentRow::Link(FeedEventLink {
        row_key: format!("event:event:shape:{shape}:kind:event-link:index:{index}"),
        item_index: index,
        url: url.to_owned(),
        text: url.to_owned(),
    })
}
