use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize, Serialize)]
pub struct GeometryKeyDto {
    pub semantic_row_key: String,
    pub visual_row_key: String,
    pub content_shape_hash: String,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub density_bucket: u16,
    pub measurement_generation: u64,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct RowGeometryStateDto {
    pub key: GeometryKeyDto,
    pub estimated_height_px: u16,
    pub reserved_height_px: u16,
    pub measured_height_px: Option<u16>,
    pub confidence: String,
    pub materialized: bool,
}

#[derive(Clone, Deserialize)]
pub struct ReservationActionDto {
    pub kind: String,
    pub key: Option<GeometryKeyDto>,
    pub height_px: Option<u16>,
    pub estimate_px: Option<u16>,
}

#[derive(Clone, Deserialize)]
pub struct ReservationInputDto {
    pub previous: Option<RowGeometryStateDto>,
    pub action: ReservationActionDto,
}

#[derive(Clone, Serialize)]
pub struct ReservationDecisionDto {
    pub state: RowGeometryStateDto,
    pub previous_reserved_height_px: Option<u16>,
    pub height_delta_px: i32,
    pub reason: String,
    pub anchor_compensation_required: bool,
    pub persist_observation: bool,
}
