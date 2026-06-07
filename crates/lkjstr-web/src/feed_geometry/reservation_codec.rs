use lkjstr_app::{
    GeometryAction, GeometryConfidence, GeometryKey, ReservedHeightDecision, ReservedHeightReason,
    RowGeometryState,
};

use super::reservation_dto::{
    GeometryKeyDto, ReservationActionDto, ReservationDecisionDto, RowGeometryStateDto,
};

pub fn reservation_action_from_dto(dto: ReservationActionDto) -> GeometryAction {
    let kind = dto.kind.clone();
    match kind.as_str() {
        "row-measured" => GeometryAction::RowMeasured {
            key: key_from_dto(dto.key.unwrap_or_default()),
            height_px: dto.height_px.unwrap_or(0),
        },
        "row-unloaded" => GeometryAction::RowUnloaded,
        "row-rematerialized" => GeometryAction::RowRematerialized,
        "row-visible" => GeometryAction::RowBecameVisible,
        "row-near-visible" => GeometryAction::RowBecameNearVisible,
        "row-far-structural" => GeometryAction::RowBecameFarStructural,
        "width-bucket-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::WidthBucketChanged { key, estimate_px }
        }),
        "font-bucket-changed" => keyed(dto, |key, estimate_px| GeometryAction::FontBucketChanged {
            key,
            estimate_px,
        }),
        "density-bucket-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::DensityBucketChanged { key, estimate_px }
        }),
        "content-shape-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::ContentShapeChanged { key, estimate_px }
        }),
        "reference-state-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::ReferenceStateChanged { key, estimate_px }
        }),
        "media-state-changed" => keyed(dto, |key, estimate_px| GeometryAction::MediaStateChanged {
            key,
            estimate_px,
        }),
        "nested-repost-state-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::NestedRepostStateChanged { key, estimate_px }
        }),
        "action-summary-state-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::ActionSummaryStateChanged { key, estimate_px }
        }),
        "schema-generation-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::SchemaGenerationChanged { key, estimate_px }
        }),
        "materialization-tier-changed" => keyed(dto, |key, estimate_px| {
            GeometryAction::MaterializationTierChanged { key, estimate_px }
        }),
        "measurement-expired" => GeometryAction::MeasurementExpired {
            estimate_px: dto.estimate_px.unwrap_or(0),
        },
        _ => GeometryAction::RowUnloaded,
    }
}

pub fn row_state_from_dto(dto: RowGeometryStateDto) -> RowGeometryState {
    RowGeometryState {
        key: key_from_dto(dto.key),
        estimated_height_px: dto.estimated_height_px,
        reserved_height_px: dto.reserved_height_px,
        measured_height_px: dto.measured_height_px,
        confidence: confidence_from_str(&dto.confidence),
        materialized: dto.materialized,
    }
}

pub fn reservation_decision_to_dto(decision: &ReservedHeightDecision) -> ReservationDecisionDto {
    ReservationDecisionDto {
        state: row_state_to_dto(&decision.state),
        previous_reserved_height_px: decision.previous_reserved_height_px,
        height_delta_px: decision.height_delta_px,
        reason: reason_to_string(&decision.reason),
        anchor_compensation_required: decision.anchor_compensation_required,
        persist_observation: decision.persist_observation,
    }
}

fn keyed(
    dto: ReservationActionDto,
    build: impl FnOnce(GeometryKey, u16) -> GeometryAction,
) -> GeometryAction {
    build(
        key_from_dto(dto.key.unwrap_or_default()),
        dto.estimate_px.unwrap_or(0),
    )
}

fn key_from_dto(dto: GeometryKeyDto) -> GeometryKey {
    GeometryKey {
        semantic_row_key: dto.semantic_row_key,
        visual_row_key: dto.visual_row_key,
        content_shape_hash: dto.content_shape_hash,
        width_bucket: dto.width_bucket,
        font_scale_bucket: dto.font_scale_bucket,
        density_bucket: dto.density_bucket,
        measurement_generation: dto.measurement_generation,
    }
}

fn row_state_to_dto(state: &RowGeometryState) -> RowGeometryStateDto {
    RowGeometryStateDto {
        key: GeometryKeyDto {
            semantic_row_key: state.key.semantic_row_key.clone(),
            visual_row_key: state.key.visual_row_key.clone(),
            content_shape_hash: state.key.content_shape_hash.clone(),
            width_bucket: state.key.width_bucket,
            font_scale_bucket: state.key.font_scale_bucket,
            density_bucket: state.key.density_bucket,
            measurement_generation: state.key.measurement_generation,
        },
        estimated_height_px: state.estimated_height_px,
        reserved_height_px: state.reserved_height_px,
        measured_height_px: state.measured_height_px,
        confidence: confidence_to_string(&state.confidence),
        materialized: state.materialized,
    }
}

fn confidence_from_str(value: &str) -> GeometryConfidence {
    match value {
        "session" => GeometryConfidence::Session,
        "durable" => GeometryConfidence::Durable,
        "degraded" => GeometryConfidence::Degraded,
        "stale" => GeometryConfidence::Stale,
        _ => GeometryConfidence::Fallback,
    }
}

fn confidence_to_string(confidence: &GeometryConfidence) -> String {
    match confidence {
        GeometryConfidence::Fallback => "fallback",
        GeometryConfidence::Session => "session",
        GeometryConfidence::Durable => "durable",
        GeometryConfidence::Degraded => "degraded",
        GeometryConfidence::Stale => "stale",
    }
    .to_owned()
}

fn reason_to_string(reason: &ReservedHeightReason) -> String {
    match reason {
        ReservedHeightReason::Estimated => "estimated",
        ReservedHeightReason::Measured => "measured",
        ReservedHeightReason::PreservedOnUnload => "preserved-on-unload",
        ReservedHeightReason::LayoutInvalidated => "layout-invalidated",
        ReservedHeightReason::ContentInvalidated => "content-invalidated",
        ReservedHeightReason::GenerationInvalidated => "generation-invalidated",
        ReservedHeightReason::TierChanged => "tier-changed",
        ReservedHeightReason::EnrichmentInvalidated => "enrichment-invalidated",
        ReservedHeightReason::VisibilityChanged => "visibility-changed",
        ReservedHeightReason::Expired => "expired",
    }
    .to_owned()
}
