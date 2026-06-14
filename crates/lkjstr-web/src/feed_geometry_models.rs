use lkjstr_app::{
    EventDisplayContext, FeedWindowState, RowGeometryModel, feed_event_geometry_model_keys,
};
use lkjstr_storage::{StorageOutcome, optimizer::FeedRowHeightModelRecord};

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_feed_row_height_model_select,
};

pub(crate) async fn feed_geometry_models(
    db_name: &str,
    worker_url: &str,
    window: &FeedWindowState,
    context: EventDisplayContext,
    width_px: u16,
    font_scale: f32,
) -> StorageOutcome<Vec<RowGeometryModel>> {
    let keys = feed_event_geometry_model_keys(window, context, width_px, font_scale);
    if keys.is_empty() {
        return StorageOutcome::Ok(Vec::new());
    }
    with_sqlite_store(db_name, worker_url, |store| async move {
        let mut models = Vec::new();
        for key in keys {
            match sqlite_feed_row_height_model_select(&store, &key).await {
                StorageOutcome::Ok(Some(row)) => models.push(model_from_record(row)),
                StorageOutcome::Ok(None) => {}
                outcome => return outcome.map(|_| Vec::new()),
            }
        }
        StorageOutcome::Ok(models)
    })
    .await
}

fn model_from_record(record: FeedRowHeightModelRecord) -> RowGeometryModel {
    RowGeometryModel {
        bucket_key: record.bucket_key,
        average_height_px: record.average_height_px,
        sample_count: record.sample_count,
        updated_at_ms: record.updated_at_ms,
    }
}
