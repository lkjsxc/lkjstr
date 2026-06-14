use crate::feed_fragments::{
    EventIndexedRow, FeedFragmentConfig, FeedVisualRow, SemanticFeedEvent, plan_feed_visual_rows,
};
use lkjstr_protocol::{
    CustomEmoji, KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT,
    custom_emoji_token_text,
};

use super::{FeedEventContentRow, FeedEventCustomEmoji, FeedEventUnavailablePreview};

#[derive(Clone, Debug, Eq, PartialEq)]
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
    custom_emojis: &[CustomEmoji],
    content_shape_hash: &str,
    estimated_height_px: u16,
    config: &FeedFragmentConfig,
) -> FeedEventContent {
    let event = SemanticFeedEvent {
        content: visible_event_content(event),
        ..event.clone()
    };
    let rows = plan_feed_visual_rows(&event, content_shape_hash, estimated_height_px, config);
    let rows = feed_event_content_rows_with_emojis(&rows, custom_emojis);
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

#[must_use]
pub fn feed_event_content_rows_with_emojis(
    rows: &[FeedVisualRow],
    custom_emojis: &[CustomEmoji],
) -> Vec<FeedEventContentRow> {
    feed_event_content_rows(rows)
        .into_iter()
        .flat_map(|row| split_text_custom_emojis(row, custom_emojis))
        .collect()
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

fn unavailable_preview(row: &EventIndexedRow) -> FeedEventUnavailablePreview {
    FeedEventUnavailablePreview {
        row_key: row.row_key.clone(),
        segment_index: row.index,
    }
}

fn split_text_custom_emojis(
    row: FeedEventContentRow,
    custom_emojis: &[CustomEmoji],
) -> Vec<FeedEventContentRow> {
    let FeedEventContentRow::Text(text) = row else {
        return vec![row];
    };
    split_custom_emoji_text(&text, custom_emojis)
}

fn split_custom_emoji_text(text: &str, custom_emojis: &[CustomEmoji]) -> Vec<FeedEventContentRow> {
    let mut rows = Vec::new();
    let mut rest = text;
    while !rest.is_empty() {
        let Some((index, emoji)) = next_custom_emoji(rest, custom_emojis) else {
            rows.push(FeedEventContentRow::Text(rest.to_owned()));
            break;
        };
        if index > 0 {
            rows.push(FeedEventContentRow::Text(rest[..index].to_owned()));
        }
        rows.push(FeedEventContentRow::CustomEmoji(emoji.into()));
        rest = &rest[index + custom_emoji_token_text(&emoji.shortcode).len()..];
    }
    rows
}

fn next_custom_emoji<'a>(
    text: &str,
    custom_emojis: &'a [CustomEmoji],
) -> Option<(usize, &'a CustomEmoji)> {
    custom_emojis
        .iter()
        .filter_map(|emoji| {
            text.find(&custom_emoji_token_text(&emoji.shortcode))
                .map(|i| (i, emoji))
        })
        .min_by_key(|(index, _)| *index)
}

impl From<&CustomEmoji> for FeedEventCustomEmoji {
    fn from(value: &CustomEmoji) -> Self {
        Self {
            shortcode: value.shortcode.clone(),
            url: value.url.clone(),
            address: value.address.clone(),
        }
    }
}
