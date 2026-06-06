use super::*;

fn key(shape: &str, width: u16, generation: u64) -> GeometryKey {
    GeometryKey {
        semantic_row_key: "event:a".to_owned(),
        visual_row_key: "event:a:full".to_owned(),
        content_shape_hash: shape.to_owned(),
        width_bucket: width,
        font_scale_bucket: 1,
        density_bucket: 1,
        measurement_generation: generation,
    }
}

fn measured_state() -> RowGeometryState {
    next_reserved_height(
        None,
        GeometryAction::RowMeasured {
            key: key("shape-a", 3, 1),
            height_px: 420,
        },
    )
    .state
}

#[test]
fn row_unloaded_preserves_measured_height() {
    let state = measured_state();
    let decision = next_reserved_height(Some(&state), GeometryAction::RowUnloaded);

    assert_eq!(decision.state.reserved_height_px, 420);
    assert!(!decision.state.materialized);
    assert_eq!(decision.height_delta_px, 0);
    assert_eq!(decision.reason, ReservedHeightReason::PreservedOnUnload);
}

#[test]
fn rematerialize_keeps_reservation_until_measurement() {
    let unloaded = next_reserved_height(Some(&measured_state()), GeometryAction::RowUnloaded).state;
    let decision = next_reserved_height(Some(&unloaded), GeometryAction::RowRematerialized);

    assert_eq!(decision.state.reserved_height_px, 420);
    assert!(decision.state.materialized);
    assert_eq!(decision.height_delta_px, 0);
}

#[test]
fn materialized_measurement_may_shrink() {
    let state = measured_state();
    let decision = next_reserved_height(
        Some(&state),
        GeometryAction::RowMeasured {
            key: key("shape-a", 3, 1),
            height_px: 260,
        },
    );

    assert_eq!(decision.state.reserved_height_px, 260);
    assert_eq!(decision.height_delta_px, -160);
}

#[test]
fn width_bucket_change_uses_new_estimate_and_may_shrink() {
    let state = measured_state();
    let decision = next_reserved_height(
        Some(&state),
        GeometryAction::WidthBucketChanged {
            key: key("shape-a", 4, 1),
            estimate_px: 240,
        },
    );

    assert_eq!(decision.state.reserved_height_px, 240);
    assert_eq!(decision.state.measured_height_px, None);
    assert_eq!(decision.height_delta_px, -180);
    assert_eq!(decision.reason, ReservedHeightReason::LayoutInvalidated);
}

#[test]
fn content_shape_and_generation_invalidate_old_measurements() {
    let state = measured_state();
    let shape = next_reserved_height(
        Some(&state),
        GeometryAction::ContentShapeChanged {
            key: key("shape-b", 3, 1),
            estimate_px: 300,
        },
    );
    let generation = next_reserved_height(
        Some(&shape.state),
        GeometryAction::SchemaGenerationChanged {
            key: key("shape-b", 3, 2),
            estimate_px: 280,
        },
    );

    assert_eq!(shape.state.confidence, GeometryConfidence::Fallback);
    assert_eq!(generation.state.reserved_height_px, 280);
    assert_eq!(
        generation.reason,
        ReservedHeightReason::GenerationInvalidated
    );
}

#[test]
fn expiration_falls_back_without_claiming_current_measurement() {
    let state = measured_state();
    let decision = next_reserved_height(
        Some(&state),
        GeometryAction::MeasurementExpired { estimate_px: 300 },
    );

    assert_eq!(decision.state.reserved_height_px, 300);
    assert_eq!(decision.state.measured_height_px, None);
    assert_eq!(decision.state.confidence, GeometryConfidence::Stale);
}
