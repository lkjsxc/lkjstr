use super::features::{RowGeometryFeatures, RowKind, geometry_bucket_key};
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
    let base = match features.row_kind {
        RowKind::Event | RowKind::ThreadRoot => 96,
        RowKind::Notification => 112,
        RowKind::ProfileSummary => 180,
        RowKind::Footer => 64,
        RowKind::Unavailable => 72,
    };
    let text = (features.content_length / 48) as u16 * 18;
    let breaks = features.line_break_count.saturating_mul(16);
    let media = features.media_count.min(4).saturating_mul(140);
    let preview = if features.has_reference_preview {
        92
    } else {
        0
    };
    let profile = if features.has_profile_summary { 88 } else { 0 };
    let chrome = if features.has_notification_chrome {
        32
    } else {
        0
    };
    let action = if features.has_action_bar { 36 } else { 0 };
    (base + text + breaks + media + preview + profile + chrome + action).clamp(48, 1200)
}

fn model_confidence(sample_count: u32) -> f64 {
    (f64::from(sample_count) / (f64::from(sample_count) + 4.0)).clamp(0.0, 0.95)
}
