use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FeedRowHeightObservationRecord {
    pub observation_id: String,
    pub row_key: String,
    pub bucket_key: String,
    pub row_kind: String,
    pub event_kind: Option<u64>,
    pub width_bucket: u16,
    pub font_scale_bucket: u16,
    pub materialization_tier: String,
    pub content_shape_hash: String,
    pub measured_height_px: u16,
    pub observed_width_px: u16,
    pub observed_at_ms: u64,
    pub created_at_ms: u64,
}

pub type SqliteFeedRowHeightObservationRow = FeedRowHeightObservationRecord;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FeedRowHeightModelRecord {
    pub bucket_key: String,
    pub average_height_px: u16,
    pub sample_count: u32,
    pub updated_at_ms: u64,
}

pub type SqliteFeedRowHeightModelRow = FeedRowHeightModelRecord;

#[must_use]
pub fn sqlite_feed_row_height_observation_row(
    record: &FeedRowHeightObservationRecord,
) -> SqliteFeedRowHeightObservationRow {
    record.clone()
}

#[must_use]
pub fn feed_row_height_observation_from_sqlite_row(
    row: &SqliteFeedRowHeightObservationRow,
) -> FeedRowHeightObservationRecord {
    row.clone()
}

#[must_use]
pub fn sqlite_feed_row_height_model_row(
    record: &FeedRowHeightModelRecord,
) -> SqliteFeedRowHeightModelRow {
    record.clone()
}

#[must_use]
pub fn feed_row_height_model_from_sqlite_row(
    row: &SqliteFeedRowHeightModelRow,
) -> FeedRowHeightModelRecord {
    row.clone()
}
