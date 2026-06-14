#![doc = "SQLite feed geometry repository calls."]

use lkjstr_storage::{
    StorageOutcome,
    optimizer::{
        FeedRowHeightModelRecord, FeedRowHeightObservationRecord, SqliteFeedRowHeightModelRow,
    },
};

use crate::sqlite_store::{
    SqliteStore,
    params::{integer, opt_integer, params, text},
    rows::first_row,
};

pub async fn sqlite_feed_row_height_observation_insert(
    store: &SqliteStore,
    row: &FeedRowHeightObservationRecord,
) -> StorageOutcome<()> {
    store
        .execute(
            "feed_row_height_observations.insert",
            observation_params(row),
        )
        .await
}

pub async fn sqlite_feed_row_height_observations_prune_before(
    store: &SqliteStore,
    before_ms: u64,
) -> StorageOutcome<()> {
    store
        .execute(
            "feed_row_height_observations.delete_before",
            params(vec![integer(before_ms)]),
        )
        .await
}

pub async fn sqlite_feed_row_height_model_select(
    store: &SqliteStore,
    bucket_key: &str,
) -> StorageOutcome<Option<FeedRowHeightModelRecord>> {
    let rows = match store
        .query(
            "feed_row_height_models.select",
            params(vec![text(bucket_key)]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row::<SqliteFeedRowHeightModelRow>(rows, "feed_row_height_models", "feed_row_height_models.select")
}

pub async fn sqlite_feed_row_height_model_upsert(
    store: &SqliteStore,
    row: &FeedRowHeightModelRecord,
) -> StorageOutcome<()> {
    store
        .execute("feed_row_height_models.upsert", model_params(row))
        .await
}

fn observation_params(row: &FeedRowHeightObservationRecord) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(&row.observation_id),
        text(&row.row_key),
        text(&row.bucket_key),
        text(&row.row_kind),
        opt_integer(row.event_kind),
        integer(u64::from(row.width_bucket)),
        integer(u64::from(row.font_scale_bucket)),
        text(&row.materialization_tier),
        text(&row.content_shape_hash),
        integer(u64::from(row.measured_height_px)),
        integer(u64::from(row.observed_width_px)),
        integer(row.observed_at_ms),
        integer(row.created_at_ms),
    ])
}

fn model_params(row: &FeedRowHeightModelRecord) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(&row.bucket_key),
        integer(u64::from(row.average_height_px)),
        integer(u64::from(row.sample_count)),
        integer(row.updated_at_ms),
    ])
}
