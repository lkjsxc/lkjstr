use serde::{Deserialize, Serialize};

fn default_materialization_tier() -> String {
    "structural".to_owned()
}

#[derive(Clone, Deserialize)]
pub struct FeaturesDto {
    pub row_kind: String,
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
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub content_shape_hash: String,
    #[serde(default = "default_materialization_tier")]
    pub materialization_tier: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ModelDto {
    pub bucket_key: String,
    pub average_height_px: u16,
    pub sample_count: u32,
    pub updated_at_ms: u64,
}

#[derive(Clone, Deserialize)]
pub struct EstimateInputDto {
    pub key: String,
    pub features: FeaturesDto,
    pub models: Vec<ModelDto>,
}

#[derive(Clone, Serialize)]
pub struct EstimateOutputDto {
    pub key: String,
    pub estimated_height_px: u16,
    pub confidence: f64,
    pub source: String,
}

#[derive(Clone, Deserialize)]
pub struct ObservationDto {
    pub key: String,
    pub features: FeaturesDto,
    pub measured_height_px: u16,
    pub width_px: u16,
    pub observed_at_ms: u64,
}

#[derive(Clone, Deserialize)]
pub struct RecordMeasurementInputDto {
    pub previous: Option<ModelDto>,
    pub observation: ObservationDto,
}

#[derive(Clone, Deserialize)]
pub struct PlanFragmentsInputDto {
    pub event_id: String,
    pub event_kind: u64,
    pub pubkey: String,
    pub created_at: u64,
    pub content: String,
    pub media_count: u16,
    pub reference_count: u16,
    pub relay_provenance: Vec<String>,
    pub has_action_bar: bool,
    pub content_shape_hash: String,
    pub estimated_height_px: u16,
    pub config: Option<FragmentConfigDto>,
}

#[derive(Clone, Deserialize)]
pub struct FragmentConfigDto {
    pub text_segment_target_chars: Option<usize>,
    pub text_segment_max_chars: Option<usize>,
    pub oversize_estimated_height_px: Option<u16>,
    pub media_items_per_segment: Option<u16>,
    pub references_per_segment: Option<u16>,
}

#[derive(Clone, Serialize)]
pub struct VisualRowDto {
    pub kind: String,
    pub event_id: String,
    pub row_key: String,
    pub segment_index: Option<u16>,
    pub text: Option<String>,
    pub starts_at: Option<usize>,
    pub ends_at: Option<usize>,
    pub index: Option<u16>,
    pub relay_provenance: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct RowDto {
    pub key: String,
    pub top_px: i32,
    pub height_px: i32,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct AnchorDto {
    pub row_key: String,
    pub offset_inside_row_px: i32,
    pub viewport_relative_top_px: i32,
    pub width_bucket: u16,
    pub generation: u64,
    pub confidence: String,
}

#[derive(Clone, Deserialize)]
pub struct CaptureAnchorInputDto {
    pub rows: Vec<RowDto>,
    pub scroll_top_px: i32,
    pub viewport_height_px: i32,
    pub width_bucket: u16,
    pub generation: u64,
}

#[derive(Clone, Deserialize)]
pub struct ReconcileAnchorInputDto {
    pub old_rows: Vec<RowDto>,
    pub new_rows: Vec<RowDto>,
    pub anchor: AnchorDto,
}

#[derive(Clone, Serialize)]
pub struct ReconcileAnchorOutputDto {
    pub scroll_delta_px: i32,
    pub confidence: String,
}
