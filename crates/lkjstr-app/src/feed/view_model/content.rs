use crate::feed_fragments::{
    EventIndexedRow, FeedFragmentConfig, FeedVisualRow, SemanticFeedEvent, plan_feed_visual_rows,
};
use lkjstr_protocol::{
    CustomEmoji, KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT,
    strip_event_reference_tokens,
};

use super::custom_emoji_rows::inject_custom_emoji_rows;
use super::link_rows::inject_link_rows;
use super::media_filter::event_media_attachments;
use super::media_rows::inject_media_rows;
use super::profile_mention_rows::inject_profile_mention_rows;
use super::reference_rows::inject_reference_rows;
use super::{FeedEventContentRow, FeedEventRepostTarget, FeedEventUnavailablePreview};

#[derive(Clone, Debug, PartialEq)]
pub enum FeedEventContent {
    Sensitive {
        reason: Option<String>,
        rows: Vec<FeedEventContentRow>,
    },
    Rows(Vec<FeedEventContentRow>),
}

#[must_use]
pub fn feed_event_content(
    has_content_warning: bool,
    reason: Option<String>,
    rows: &[FeedVisualRow],
) -> FeedEventContent {
    content_with_warning(has_content_warning, reason, feed_event_content_rows(rows))
}

#[must_use]
pub fn plan_feed_event_content(
    has_content_warning: bool,
    reason: Option<String>,
    event: &SemanticFeedEvent,
    custom_emojis: &[CustomEmoji],
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> FeedEventContent {
    plan_feed_event_content_with_repost_target(
        (has_content_warning, reason),
        event,
        custom_emojis,
        content_shape_hash,
        estimated_height_px,
        config,
        None,
    )
}

#[must_use]
pub(crate) fn plan_feed_event_content_with_repost_target(
    warning: (bool, Option<String>),
    event: &SemanticFeedEvent,
    custom_emojis: &[CustomEmoji],
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
    repost_target: Option<FeedEventRepostTarget>,
) -> FeedEventContent {
    let mut rows = planned_content_rows(
        event,
        custom_emojis,
        content_shape_hash,
        estimated_height_px,
        config,
    );
    if let Some(target) = repost_target {
        rows.push(FeedEventContentRow::RepostTarget(target));
    }
    content_with_warning(warning.0, warning.1, rows)
}

#[must_use]
pub(crate) fn plan_feed_event_content_without_repost_target(
    has_content_warning: bool,
    reason: Option<String>,
    event: &SemanticFeedEvent,
    custom_emojis: &[CustomEmoji],
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> FeedEventContent {
    content_with_warning(
        has_content_warning,
        reason,
        planned_content_rows(
            event,
            custom_emojis,
            content_shape_hash,
            estimated_height_px,
            config,
        ),
    )
}

fn planned_content_rows(
    event: &SemanticFeedEvent,
    custom_emojis: &[CustomEmoji],
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> Vec<FeedEventContentRow> {
    let media_attachments = event_media_attachments(event);
    let event = SemanticFeedEvent {
        content: visible_event_content(event),
        media_count: media_attachments.len().min(usize::from(u16::MAX)) as u16,
        media_attachments,
        ..event.clone()
    };
    let rows = plan_feed_visual_rows(&event, content_shape_hash, estimated_height_px, config);
    let rows = feed_event_content_rows(&rows);
    let rows = inject_custom_emoji_rows(rows, &event.event_id, content_shape_hash, custom_emojis);
    let rows = inject_profile_mention_rows(rows, &event.event_id, content_shape_hash);
    let rows = inject_link_rows(
        rows,
        &event.event_id,
        content_shape_hash,
        &event.media_attachments,
    );
    let rows = inject_media_rows(
        rows,
        &event.event_id,
        content_shape_hash,
        &event.media_attachments,
        config.media_items_per_segment,
    );
    inject_reference_rows(
        rows,
        &event.event_id,
        content_shape_hash,
        &event.event_references,
        config.references_per_segment,
    )
}

fn content_with_warning(
    has_content_warning: bool,
    reason: Option<String>,
    rows: Vec<FeedEventContentRow>,
) -> FeedEventContent {
    if has_content_warning {
        return FeedEventContent::Sensitive {
            reason: reason.filter(|item| !item.trim().is_empty()),
            rows,
        };
    }
    FeedEventContent::Rows(rows)
}
#[must_use]
pub fn feed_event_content_rows(rows: &[FeedVisualRow]) -> Vec<FeedEventContentRow> {
    rows.iter().filter_map(feed_event_content_row).collect()
}

fn feed_event_content_row(row: &FeedVisualRow) -> Option<FeedEventContentRow> {
    match row {
        FeedVisualRow::EventFull(row) => Some(FeedEventContentRow::Text(row.content.clone())),
        FeedVisualRow::EventTextSegment(row) => Some(FeedEventContentRow::Text(row.text.clone())),
        FeedVisualRow::EventMediaSegment(row) => Some(
            FeedEventContentRow::MediaPreviewUnavailable(unavailable_preview(row)),
        ),
        FeedVisualRow::EventReferenceSegment(row) => Some(
            FeedEventContentRow::ReferencePreviewUnavailable(unavailable_preview(row)),
        ),
        FeedVisualRow::EventHeader(_) | FeedVisualRow::EventActions(_) => None,
    }
}

fn visible_event_content(event: &SemanticFeedEvent) -> String {
    match event.event_kind {
        KIND_REPOST | KIND_GENERIC_REPOST => "Reposted target unavailable".to_owned(),
        KIND_REACTION => reaction_summary(&event.content),
        KIND_ZAP_RECEIPT => "Zap receipt target unavailable".to_owned(),
        _ => strip_event_reference_tokens(&event.content, &event.event_references),
    }
}

fn reaction_summary(content: &str) -> String {
    let content = content.trim();
    if content.is_empty() {
        return "Reaction target unavailable".to_owned();
    }
    format!("Reacted with {content}")
}

fn unavailable_preview(row: &EventIndexedRow) -> FeedEventUnavailablePreview {
    FeedEventUnavailablePreview {
        row_key: row.row_key.clone(),
        segment_index: row.index,
    }
}
