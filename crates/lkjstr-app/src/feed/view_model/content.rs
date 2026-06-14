use crate::feed_fragments::{
    FeedFragmentConfig, FeedVisualRow, SemanticFeedEvent, plan_feed_visual_rows,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContent {
    Sensitive {
        reason: Option<String>,
        rows: Vec<FeedEventContentRow>,
    },
    Rows(Vec<FeedEventContentRow>),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContentRow {
    Text(String),
    MediaPreviewUnavailable,
    ReferencePreviewUnavailable,
}

impl FeedEventContentRow {
    #[must_use]
    pub fn text(&self) -> &str {
        match self {
            Self::Text(text) => text,
            Self::MediaPreviewUnavailable => "Media preview unavailable",
            Self::ReferencePreviewUnavailable => "Reference preview unavailable",
        }
    }
}

#[must_use]
pub fn feed_event_content(
    has_content_warning: bool,
    reason: Option<String>,
    rows: &[FeedVisualRow],
) -> FeedEventContent {
    let rows = feed_event_content_rows(rows);
    if has_content_warning {
        return FeedEventContent::Sensitive {
            reason: reason.filter(|item| !item.trim().is_empty()),
            rows,
        };
    }
    FeedEventContent::Rows(rows)
}

#[must_use]
pub fn plan_feed_event_content(
    has_content_warning: bool,
    reason: Option<String>,
    event: &SemanticFeedEvent,
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> FeedEventContent {
    let event = SemanticFeedEvent {
        content: visible_event_content(event),
        ..event.clone()
    };
    let rows = plan_feed_visual_rows(&event, content_shape_hash, estimated_height_px, config);
    feed_event_content(has_content_warning, reason, &rows)
}

#[must_use]
pub fn feed_event_content_rows(rows: &[FeedVisualRow]) -> Vec<FeedEventContentRow> {
    rows.iter().filter_map(feed_event_content_row).collect()
}

fn feed_event_content_row(row: &FeedVisualRow) -> Option<FeedEventContentRow> {
    match row {
        FeedVisualRow::EventFull(row) => Some(FeedEventContentRow::Text(row.content.clone())),
        FeedVisualRow::EventTextSegment(row) => Some(FeedEventContentRow::Text(row.text.clone())),
        FeedVisualRow::EventMediaSegment(_) => Some(FeedEventContentRow::MediaPreviewUnavailable),
        FeedVisualRow::EventReferenceSegment(_) => {
            Some(FeedEventContentRow::ReferencePreviewUnavailable)
        }
        FeedVisualRow::EventHeader(_) | FeedVisualRow::EventActions(_) => None,
    }
}

fn visible_event_content(event: &SemanticFeedEvent) -> String {
    match event.event_kind {
        KIND_REPOST | KIND_GENERIC_REPOST => "Reposted target unavailable".to_owned(),
        KIND_REACTION => reaction_summary(&event.content),
        KIND_ZAP_RECEIPT => "Zap receipt target unavailable".to_owned(),
        _ => event.content.clone(),
    }
}

fn reaction_summary(content: &str) -> String {
    let content = content.trim();
    if content.is_empty() {
        return "Reaction target unavailable".to_owned();
    }
    format!("Reacted with {content}")
}
