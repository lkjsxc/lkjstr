use lkjstr_storage::optimizer::{
    FeedRowHeightModelRecord, FeedRowHeightObservationRecord,
    feed_row_height_model_from_sqlite_row, feed_row_height_observation_from_sqlite_row,
    sqlite_feed_row_height_model_row, sqlite_feed_row_height_observation_row,
};

#[test]
fn feed_row_height_observation_round_trips_without_raw_content() {
    let record = observation();
    let row = sqlite_feed_row_height_observation_row(&record);

    assert_eq!(row.content_shape_hash, "shape");
    assert_eq!(feed_row_height_observation_from_sqlite_row(&row), record);
}

#[test]
fn feed_row_height_model_round_trips_by_bucket() {
    let record = FeedRowHeightModelRecord {
        bucket_key: "Event|w:2|shape".to_owned(),
        average_height_px: 144,
        sample_count: 3,
        updated_at_ms: 2_000,
    };
    let row = sqlite_feed_row_height_model_row(&record);

    assert_eq!(feed_row_height_model_from_sqlite_row(&row), record);
}

fn observation() -> FeedRowHeightObservationRecord {
    FeedRowHeightObservationRecord {
        observation_id: "obs-1".to_owned(),
        row_key: "event:abc:body:0".to_owned(),
        bucket_key: "Event|w:2|shape".to_owned(),
        row_kind: "event-text-segment".to_owned(),
        event_kind: Some(1),
        width_bucket: 2,
        font_scale_bucket: 1,
        materialization_tier: "structural".to_owned(),
        content_shape_hash: "shape".to_owned(),
        measured_height_px: 180,
        observed_width_px: 640,
        observed_at_ms: 1_000,
        created_at_ms: 1_001,
    }
}
