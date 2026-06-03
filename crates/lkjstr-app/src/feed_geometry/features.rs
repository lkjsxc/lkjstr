#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RowKind {
    Event,
    Notification,
    ProfileSummary,
    ThreadRoot,
    Footer,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowGeometryFeatures {
    pub row_kind: RowKind,
    pub content_length: u32,
    pub line_break_count: u16,
    pub url_count: u16,
    pub media_count: u16,
    pub has_reference_preview: bool,
    pub has_profile_summary: bool,
    pub has_notification_chrome: bool,
    pub has_action_bar: bool,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
}

#[must_use]
pub fn geometry_bucket_key(features: &RowGeometryFeatures) -> String {
    format!(
        "{:?}|w:{}|f:{}|m:{}|r:{}|p:{}|n:{}|a:{}",
        features.row_kind,
        features.width_bucket,
        features.font_scale_bucket,
        capped(features.media_count, 4),
        features.has_reference_preview,
        features.has_profile_summary,
        features.has_notification_chrome,
        features.has_action_bar
    )
}

fn capped(value: u16, cap: u16) -> u16 {
    value.min(cap)
}
