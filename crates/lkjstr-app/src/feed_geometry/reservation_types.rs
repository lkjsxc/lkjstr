use super::features::{RowGeometryFeatures, RowKind};
use super::hash::MaterializationTier;
use super::model::RowHeightObservation;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EnrichmentResolutionState {
    None,
    Loading,
    ResolvedCompact,
    ResolvedExpanded,
    Unavailable,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct GeometryKey {
    pub semantic_row_key: String,
    pub visual_row_key: String,
    pub content_shape_hash: String,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub density_bucket: u16,
    pub measurement_generation: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GeometryConfidence {
    Fallback,
    Session,
    Durable,
    Degraded,
    Stale,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReservedHeightReason {
    Estimated,
    Measured,
    PreservedOnUnload,
    LayoutInvalidated,
    ContentInvalidated,
    GenerationInvalidated,
    TierChanged,
    EnrichmentInvalidated,
    VisibilityChanged,
    Expired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RowGeometryState {
    pub key: GeometryKey,
    pub estimated_height_px: u16,
    pub reserved_height_px: u16,
    pub measured_height_px: Option<u16>,
    pub confidence: GeometryConfidence,
    pub materialized: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GeometryAction {
    RowMeasured { key: GeometryKey, height_px: u16 },
    RowUnloaded,
    RowRematerialized,
    RowBecameVisible,
    RowBecameNearVisible,
    RowBecameFarStructural,
    WidthBucketChanged { key: GeometryKey, estimate_px: u16 },
    FontBucketChanged { key: GeometryKey, estimate_px: u16 },
    DensityBucketChanged { key: GeometryKey, estimate_px: u16 },
    ContentShapeChanged { key: GeometryKey, estimate_px: u16 },
    ReferenceStateChanged { key: GeometryKey, estimate_px: u16 },
    MediaStateChanged { key: GeometryKey, estimate_px: u16 },
    NestedRepostStateChanged { key: GeometryKey, estimate_px: u16 },
    ActionSummaryStateChanged { key: GeometryKey, estimate_px: u16 },
    SchemaGenerationChanged { key: GeometryKey, estimate_px: u16 },
    MaterializationTierChanged { key: GeometryKey, estimate_px: u16 },
    MeasurementExpired { estimate_px: u16 },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReservedHeightDecision {
    pub state: RowGeometryState,
    pub previous_reserved_height_px: Option<u16>,
    pub height_delta_px: i32,
    pub reason: ReservedHeightReason,
    pub anchor_compensation_required: bool,
    pub persist_observation: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeedRowReservationInput {
    pub semantic_row_key: String,
    pub visual_row_key: String,
    pub row_kind: RowKind,
    pub event_kind: Option<u64>,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub density_bucket: u16,
    pub content_shape_hash: String,
    pub materialization_tier: MaterializationTier,
    pub reference_state: EnrichmentResolutionState,
    pub media_state: EnrichmentResolutionState,
    pub nested_repost_state: EnrichmentResolutionState,
    pub action_summary_state: EnrichmentResolutionState,
    pub geometry_schema_generation: u64,
    pub previous_state: Option<RowGeometryState>,
    pub features: Option<RowGeometryFeatures>,
    pub observation: Option<RowHeightObservation>,
    pub action: GeometryAction,
}
