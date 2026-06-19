use super::hash::{ContentShapeInput, MaterializationTier, content_shape_hash};
use super::width_bucket::WidthBucket;
use lkjstr_protocol::{
    NostrEvent, embedded_media_attachments,
    kinds::{KIND_DELETION, KIND_GENERIC_REPOST, KIND_REACTION, KIND_REPOST, KIND_ZAP_RECEIPT},
    tag_values,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RowKind {
    Event,
    EventHeader,
    EventTextSegment,
    EventMediaSegment,
    EventReferenceSegment,
    EventActions,
    RepostTarget,
    Notification,
    ProfileSummary,
    ThreadRoot,
    Footer,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowGeometryFeatures {
    pub row_kind: RowKind,
    pub event_kind: Option<u64>,
    pub content_length: u32,
    pub unicode_scalar_count: u32,
    pub line_break_count: u16,
    pub longest_unbroken_token_length: u32,
    pub url_count: u16,
    pub media_count: u16,
    pub reference_preview_count: u16,
    pub custom_emoji_count: u16,
    pub has_content_warning: bool,
    pub has_profile_summary: bool,
    pub has_notification_chrome: bool,
    pub has_action_bar: bool,
    pub materialization_tier: MaterializationTier,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub content_shape_hash: String,
}

#[must_use]
pub fn event_geometry_features(
    event: &NostrEvent,
    row_kind: RowKind,
    width_px: u16,
    font_scale: f32,
    has_notification_chrome: bool,
    has_action_bar: bool,
    materialization_tier: MaterializationTier,
) -> RowGeometryFeatures {
    let content = geometry_visible_content(event);
    let media_count = as_u16(embedded_media_attachments(event).len());
    let reference_preview_count = count_reference_tags(&event.tags);
    let custom_emoji_count = count_custom_emoji_tags(&event.tags);
    let shape = ContentShapeInput {
        content_length: as_u32(content.len()),
        unicode_scalar_count: as_u32(content.chars().count()),
        line_break_count: as_u16(content.matches('\n').count()),
        longest_unbroken_token_length: longest_token(&content),
        url_count: count_urls(&content),
        media_count,
        reference_preview_count,
        custom_emoji_count,
        has_content_warning: has_content_warning(&event.tags),
        fragment_count: 1,
        materialization_tier,
    };
    RowGeometryFeatures {
        row_kind,
        event_kind: Some(event.kind),
        content_length: shape.content_length,
        unicode_scalar_count: shape.unicode_scalar_count,
        line_break_count: shape.line_break_count,
        longest_unbroken_token_length: shape.longest_unbroken_token_length,
        url_count: shape.url_count,
        media_count,
        reference_preview_count,
        custom_emoji_count,
        has_content_warning: shape.has_content_warning,
        has_profile_summary: false,
        has_notification_chrome,
        has_action_bar,
        materialization_tier,
        width_bucket: WidthBucket::from_width_px(width_px).as_model_bucket(),
        font_scale_bucket: font_scale_bucket(font_scale),
        content_shape_hash: content_shape_hash(&shape),
    }
}

#[must_use]
pub fn geometry_bucket_key(features: &RowGeometryFeatures) -> String {
    format!(
        "{:?}|k:{:?}|shape:{}|w:{}|f:{}|m:{}|r:{}|e:{}|n:{}|a:{}",
        features.row_kind,
        features.event_kind,
        features.content_shape_hash,
        features.width_bucket,
        features.font_scale_bucket,
        capped(features.media_count, 8),
        capped(features.reference_preview_count, 8),
        capped(features.custom_emoji_count, 16),
        features.has_notification_chrome,
        features.has_action_bar
    )
}

fn geometry_visible_content(event: &NostrEvent) -> String {
    match event.kind {
        KIND_REPOST => "reposted".to_owned(),
        KIND_GENERIC_REPOST => format!("reposted {}", generic_repost_target(event)),
        KIND_REACTION => "reacted with".to_owned(),
        KIND_DELETION => "deleted a referenced event".to_owned(),
        KIND_ZAP_RECEIPT => "zapped this event".to_owned(),
        _ => event.content.clone(),
    }
}

fn generic_repost_target(event: &NostrEvent) -> String {
    tag_values(event, "k")
        .first()
        .map_or_else(|| "an event".to_owned(), |kind| format!("kind {kind}"))
}

fn count_reference_tags(tags: &[Vec<String>]) -> u16 {
    as_u16(
        tags.iter()
            .filter(|tag| tag_name_is(tag, "e") || tag_name_is(tag, "a") || tag_name_is(tag, "q"))
            .count(),
    )
}

fn count_custom_emoji_tags(tags: &[Vec<String>]) -> u16 {
    as_u16(tags.iter().filter(|tag| tag_name_is(tag, "emoji")).count())
}

fn tag_name_is(tag: &[String], name: &str) -> bool {
    tag.first().is_some_and(|value| value == name)
}

fn has_content_warning(tags: &[Vec<String>]) -> bool {
    tags.iter().any(|tag| tag_name_is(tag, "content-warning"))
}

fn count_urls(content: &str) -> u16 {
    as_u16(
        content
            .split_whitespace()
            .filter(|token| token.starts_with("http://") || token.starts_with("https://"))
            .count(),
    )
}

fn longest_token(content: &str) -> u32 {
    content
        .split_whitespace()
        .map(|token| as_u32(token.chars().count()))
        .max()
        .unwrap_or(0)
}

fn font_scale_bucket(scale: f32) -> u16 {
    if scale < 0.90 {
        0
    } else if scale < 1.10 {
        1
    } else if scale < 1.30 {
        2
    } else if scale < 1.60 {
        3
    } else {
        4
    }
}

fn capped(value: u16, cap: u16) -> u16 {
    value.min(cap)
}

fn as_u16(value: usize) -> u16 {
    value.min(usize::from(u16::MAX)) as u16
}

fn as_u32(value: usize) -> u32 {
    value.min(u32::MAX as usize) as u32
}
