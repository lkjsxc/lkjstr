use super::reservation_types::{
    GeometryAction, GeometryConfidence, GeometryKey, ReservedHeightDecision, ReservedHeightReason,
    RowGeometryState,
};

#[must_use]
pub fn next_reserved_height(
    previous: Option<&RowGeometryState>,
    action: GeometryAction,
) -> ReservedHeightDecision {
    match action {
        GeometryAction::RowMeasured { key, height_px } => measured(previous, key, height_px),
        GeometryAction::RowUnloaded => preserve_on_unload(previous),
        GeometryAction::RowRematerialized => rematerialized(previous),
        GeometryAction::WidthBucketChanged { key, estimate_px }
        | GeometryAction::FontBucketChanged { key, estimate_px }
        | GeometryAction::DensityBucketChanged { key, estimate_px } => invalidated(
            previous,
            key,
            estimate_px,
            ReservedHeightReason::LayoutInvalidated,
        ),
        GeometryAction::ContentShapeChanged { key, estimate_px } => invalidated(
            previous,
            key,
            estimate_px,
            ReservedHeightReason::ContentInvalidated,
        ),
        GeometryAction::SchemaGenerationChanged { key, estimate_px } => invalidated(
            previous,
            key,
            estimate_px,
            ReservedHeightReason::GenerationInvalidated,
        ),
        GeometryAction::MaterializationTierChanged { key, estimate_px } => invalidated(
            previous,
            key,
            estimate_px,
            ReservedHeightReason::TierChanged,
        ),
        GeometryAction::MeasurementExpired { estimate_px } => expired(previous, estimate_px),
    }
}

fn measured(
    previous: Option<&RowGeometryState>,
    key: GeometryKey,
    height_px: u16,
) -> ReservedHeightDecision {
    let old = previous.map(|state| state.reserved_height_px);
    let state = RowGeometryState {
        key,
        estimated_height_px: previous.map_or(height_px, |state| state.estimated_height_px),
        reserved_height_px: height_px,
        measured_height_px: Some(height_px),
        confidence: GeometryConfidence::Session,
        materialized: true,
    };
    decision(state, old, ReservedHeightReason::Measured)
}

fn preserve_on_unload(previous: Option<&RowGeometryState>) -> ReservedHeightDecision {
    let Some(previous) = previous else {
        return fallback_empty(ReservedHeightReason::PreservedOnUnload);
    };
    let mut state = previous.clone();
    state.materialized = false;
    decision(
        state,
        Some(previous.reserved_height_px),
        ReservedHeightReason::PreservedOnUnload,
    )
}

fn rematerialized(previous: Option<&RowGeometryState>) -> ReservedHeightDecision {
    let Some(previous) = previous else {
        return fallback_empty(ReservedHeightReason::Estimated);
    };
    let mut state = previous.clone();
    state.materialized = true;
    decision(
        state,
        Some(previous.reserved_height_px),
        ReservedHeightReason::Estimated,
    )
}

fn invalidated(
    previous: Option<&RowGeometryState>,
    key: GeometryKey,
    estimate_px: u16,
    reason: ReservedHeightReason,
) -> ReservedHeightDecision {
    let old = previous.map(|state| state.reserved_height_px);
    let state = RowGeometryState {
        key,
        estimated_height_px: estimate_px,
        reserved_height_px: estimate_px,
        measured_height_px: None,
        confidence: GeometryConfidence::Fallback,
        materialized: previous.is_none_or(|state| state.materialized),
    };
    decision(state, old, reason)
}

fn expired(previous: Option<&RowGeometryState>, estimate_px: u16) -> ReservedHeightDecision {
    let Some(previous) = previous else {
        return fallback_empty(ReservedHeightReason::Expired);
    };
    let state = RowGeometryState {
        key: previous.key.clone(),
        estimated_height_px: estimate_px,
        reserved_height_px: estimate_px,
        measured_height_px: None,
        confidence: GeometryConfidence::Stale,
        materialized: previous.materialized,
    };
    decision(
        state,
        Some(previous.reserved_height_px),
        ReservedHeightReason::Expired,
    )
}

fn decision(
    state: RowGeometryState,
    old: Option<u16>,
    reason: ReservedHeightReason,
) -> ReservedHeightDecision {
    let height_delta_px = old.map_or(0, |value| {
        i32::from(state.reserved_height_px) - i32::from(value)
    });
    ReservedHeightDecision {
        state,
        previous_reserved_height_px: old,
        height_delta_px,
        reason,
    }
}

fn fallback_empty(reason: ReservedHeightReason) -> ReservedHeightDecision {
    decision(
        RowGeometryState {
            key: GeometryKey::default(),
            estimated_height_px: 0,
            reserved_height_px: 0,
            measured_height_px: None,
            confidence: GeometryConfidence::Fallback,
            materialized: false,
        },
        None,
        reason,
    )
}
