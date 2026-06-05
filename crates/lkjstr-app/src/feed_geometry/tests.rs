use super::*;
use lkjstr_protocol::NostrEvent;

fn event(content: String, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 42,
        kind: 1,
        tags,
        content,
        sig: "c".repeat(128),
    }
}

fn features_for(content: &str, width: u16) -> RowGeometryFeatures {
    event_geometry_features(
        &event(content.to_owned(), Vec::new()),
        RowKind::Event,
        width,
        1.0,
        false,
        true,
    )
}

#[test]
fn formula_reserves_height_before_enrichment() {
    let estimate = estimate_row_geometry("event-a", &features_for("hello", 640), &[]);

    assert!(estimate.estimated_height_px >= 96);
    assert_eq!(estimate.source, GeometryEstimateSource::FeatureFormula);
}

#[test]
fn long_text_gets_larger_estimate_than_short_note() {
    let short = estimate_row_geometry("short", &features_for("hello", 640), &[]);
    let long = estimate_row_geometry("long", &features_for(&"x".repeat(20_000), 640), &[]);

    assert!(long.estimated_height_px > short.estimated_height_px.saturating_mul(8));
}

#[test]
fn line_breaks_and_long_tokens_affect_estimate() {
    let plain = estimate_row_geometry("plain", &features_for(&"x".repeat(3_000), 640), &[]);
    let breaks = estimate_row_geometry("breaks", &features_for(&"x\n".repeat(300), 640), &[]);
    let token = estimate_row_geometry("token", &features_for(&"y".repeat(5_000), 320), &[]);

    assert!(breaks.estimated_height_px > plain.estimated_height_px / 2);
    assert!(token.estimated_height_px > 1_400);
}

#[test]
fn event_feature_extraction_counts_shape_inputs() {
    let tags = vec![
        vec![
            "imeta".to_owned(),
            "url https://example.test/a.png".to_owned(),
        ],
        vec!["e".to_owned(), "a".repeat(64)],
        vec![
            "emoji".to_owned(),
            "blobcat".to_owned(),
            "https://e.test/c.png".to_owned(),
        ],
        vec!["content-warning".to_owned(), "reason".to_owned()],
    ];
    let features = event_geometry_features(
        &event("hello https://example.test\nworld".to_owned(), tags),
        RowKind::Notification,
        480,
        1.25,
        true,
        true,
    );

    assert_eq!(features.url_count, 1);
    assert_eq!(features.media_count, 1);
    assert_eq!(features.reference_preview_count, 1);
    assert_eq!(features.custom_emoji_count, 1);
    assert!(features.has_content_warning);
    assert!(features.has_notification_chrome);
    assert_eq!(features.font_scale_bucket, 2);
}

#[test]
fn measured_model_improves_confidence() {
    let observation = RowHeightObservation {
        key: "event-a".to_owned(),
        features: features_for("hello", 640),
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
fn content_shape_hash_is_stable_and_sensitive() {
    let shape = ContentShapeInput {
        content_length: 10,
        unicode_scalar_count: 10,
        line_break_count: 1,
        longest_unbroken_token_length: 5,
        url_count: 0,
        media_count: 0,
        reference_preview_count: 0,
        custom_emoji_count: 0,
        has_content_warning: false,
        fragment_count: 1,
    };
    let mut changed = shape.clone();
    changed.line_break_count = 2;

    assert_eq!(content_shape_hash(&shape), content_shape_hash(&shape));
    assert_ne!(content_shape_hash(&shape), content_shape_hash(&changed));
}

#[test]
fn capture_and_reconcile_anchor_for_height_delta_above() {
    let old_rows = rows(&[("a", 0, 100), ("b", 100, 100)]);
    let new_rows = rows(&[("a", 0, 130), ("b", 130, 100)]);
    let anchor = capture_feed_anchor(&old_rows, 120, 500, 3, 1).unwrap();
    let result = reconcile_feed_anchor(&old_rows, &new_rows, &anchor);

    assert_eq!(anchor.row_key, "b");
    assert_eq!(result.scroll_delta_px, 30);
    assert_eq!(result.confidence, AnchorConfidence::Exact);
}

#[test]
fn row_removal_uses_nearest_survivor_with_degraded_confidence() {
    let old_rows = rows(&[("a", 0, 100), ("b", 100, 100), ("c", 200, 100)]);
    let new_rows = rows(&[("a", 0, 120), ("c", 120, 100)]);
    let anchor = capture_feed_anchor(&old_rows, 120, 500, 3, 1).unwrap();
    let result = reconcile_feed_anchor(&old_rows, &new_rows, &anchor);

    assert_eq!(result.scroll_delta_px, 0);
    assert_eq!(result.confidence, AnchorConfidence::Degraded);
}

#[test]
fn width_buckets_match_feed_surface_contract() {
    assert_eq!(WidthBucket::from_width_px(100).as_key(), "0-319");
    assert_eq!(WidthBucket::from_width_px(320).as_key(), "320-479");
    assert_eq!(WidthBucket::from_width_px(480).as_key(), "480-639");
    assert_eq!(WidthBucket::from_width_px(640).as_key(), "640-799");
    assert_eq!(WidthBucket::from_width_px(800).as_key(), "800-1023");
    assert_eq!(WidthBucket::from_width_px(1024).as_key(), "1024+");
}

fn rows(items: &[(&str, i32, i32)]) -> Vec<MeasuredFeedRow> {
    items
        .iter()
        .map(|(key, top, height)| MeasuredFeedRow {
            key: (*key).to_owned(),
            top_px: *top,
            height_px: *height,
        })
        .collect()
}
