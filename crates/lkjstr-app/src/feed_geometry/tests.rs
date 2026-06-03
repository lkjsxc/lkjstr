use super::*;

fn features() -> RowGeometryFeatures {
    RowGeometryFeatures {
        row_kind: RowKind::Event,
        content_length: 240,
        line_break_count: 1,
        url_count: 1,
        media_count: 0,
        has_reference_preview: false,
        has_profile_summary: false,
        has_notification_chrome: false,
        has_action_bar: true,
        width_bucket: 40,
        font_scale_bucket: 10,
    }
}

#[test]
fn formula_reserves_height_before_enrichment() {
    let estimate = estimate_row_geometry("event-a", &features(), &[]);

    assert!(estimate.estimated_height_px >= 96);
    assert_eq!(estimate.source, GeometryEstimateSource::FeatureFormula);
}

#[test]
fn measured_model_improves_confidence() {
    let observation = RowHeightObservation {
        key: "event-a".to_owned(),
        features: features(),
        measured_height_px: 220,
        width_px: 640,
        observed_at_ms: 10,
    };
    let model = update_row_geometry_model(None, &observation);
    let estimate = estimate_row_geometry("event-b", &observation.features, &[model]);

    assert_eq!(estimate.estimated_height_px, 220);
    assert!(estimate.confidence > 0.0);
}

#[test]
fn height_delta_above_viewport_compensates_anchor() {
    let compensation = anchor_compensation_for_height_delta(100, 200, 32);

    assert!(compensation.should_apply);
    assert_eq!(compensation.scroll_delta_px, 32);
}

#[test]
fn visible_row_height_delta_does_not_compensate() {
    let compensation = anchor_compensation_for_height_delta(220, 200, 32);

    assert!(!compensation.should_apply);
    assert_eq!(compensation.scroll_delta_px, 0);
}
