use super::features::{RowGeometryFeatures, RowKind, geometry_bucket_key};
use super::hash::MaterializationTier;
use super::model::RowGeometryModel;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GeometryEstimateSource {
    ExactKey,
    FeatureFormula,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RowGeometryEstimate {
    pub key: String,
    pub estimated_height_px: u16,
    pub confidence: f64,
    pub source: GeometryEstimateSource,
}

#[must_use]
pub fn estimate_row_geometry(
    key: impl Into<String>,
    features: &RowGeometryFeatures,
    models: &[RowGeometryModel],
) -> RowGeometryEstimate {
    let key = key.into();
    let bucket = geometry_bucket_key(features);
    if let Some(model) = models.iter().find(|model| model.bucket_key == bucket) {
        return RowGeometryEstimate {
            key,
            estimated_height_px: model.average_height_px,
            confidence: model_confidence(model.sample_count),
            source: GeometryEstimateSource::ExactKey,
        };
    }
    RowGeometryEstimate {
        key,
        estimated_height_px: formula_height(features),
        confidence: 0.25,
        source: GeometryEstimateSource::FeatureFormula,
    }
}

fn formula_height(features: &RowGeometryFeatures) -> u16 {
    let base = base_height(features.row_kind.clone());
    let text = estimated_text_height(features);
    let media = features.media_count.min(6).saturating_mul(150);
    let previews = reference_preview_height(features);
    let profile = if features.has_profile_summary { 88 } else { 0 };
    let chrome = if features.has_notification_chrome {
        36
    } else {
        0
    };
    let action = if features.has_action_bar { 40 } else { 0 };
    let warning = if features.has_content_warning { 28 } else { 0 };
    (base + text + media + previews + profile + chrome + action + warning).clamp(48, 8_000)
}

fn reference_preview_height(features: &RowGeometryFeatures) -> u16 {
    let count = features.reference_preview_count.min(6);
    if count == 0 {
        return 0;
    }
    match features.materialization_tier {
        MaterializationTier::Enriched => count.saturating_mul(96),
        MaterializationTier::Structural => count.min(3).saturating_mul(36),
        MaterializationTier::Shell => 0,
    }
}

fn base_height(row_kind: RowKind) -> u16 {
    match row_kind {
        RowKind::Event | RowKind::ThreadRoot => 96,
        RowKind::RepostTarget => 104,
        RowKind::EventHeader => 72,
        RowKind::EventTextSegment => 48,
        RowKind::EventMediaSegment => 180,
        RowKind::EventReferenceSegment => 120,
        RowKind::EventActions => 56,
        RowKind::Notification => 116,
        RowKind::ProfileSummary => 180,
        RowKind::Footer => 64,
        RowKind::Unavailable => 72,
    }
}

fn estimated_text_height(features: &RowGeometryFeatures) -> u16 {
    let chars_per_line = chars_per_line(features.width_bucket).max(1);
    let wrap_lines = div_ceil(features.unicode_scalar_count, chars_per_line);
    let token_extra = div_ceil(features.longest_unbroken_token_length, chars_per_line * 2);
    let explicit_breaks = u32::from(features.line_break_count);
    let url_extra = u32::from(features.url_count.min(12)) * 2;
    let emoji_extra = u32::from(features.custom_emoji_count.min(24)) / 4;
    let lines = wrap_lines
        .saturating_add(explicit_breaks)
        .saturating_add(token_extra)
        .saturating_add(url_extra)
        .saturating_add(emoji_extra);
    let line_px = 20 + u32::from(features.font_scale_bucket.min(4)) * 2;
    lines.saturating_mul(line_px).min(u32::from(u16::MAX)) as u16
}

fn chars_per_line(width_bucket: u16) -> u32 {
    match width_bucket {
        0 => 30,
        1 => 42,
        2 => 56,
        3 => 72,
        4 => 88,
        _ => 108,
    }
}

fn div_ceil(value: u32, divisor: u32) -> u32 {
    value.saturating_add(divisor.saturating_sub(1)) / divisor
}

fn model_confidence(sample_count: u32) -> f64 {
    (f64::from(sample_count) / (f64::from(sample_count) + 4.0)).clamp(0.0, 0.95)
}
