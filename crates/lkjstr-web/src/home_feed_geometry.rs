use lkjstr_app::{
    EventDisplayContext, FeedWindowState, HomeFeedDiagnosticInput, RowGeometryModel,
    feed_event_geometry_model_keys,
};
use lkjstr_storage::{StorageOutcome, optimizer::FeedRowHeightModelRecord};

use crate::{
    home_feed_host::{HomeFeedHost, diagnostic},
    host_status::problem_status,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_feed_row_height_model_select,
};

pub(crate) async fn home_feed_geometry_models(
    host: &HomeFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<HomeFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    let keys =
        feed_event_geometry_model_keys(window, EventDisplayContext::Timeline, width_px, font_scale);
    if keys.is_empty() {
        return Vec::new();
    }
    match select_models(host, keys).await {
        StorageOutcome::Ok(models) => models,
        outcome => {
            diagnostics.push(diagnostic(
                "feed-geometry",
                &problem_status("Feed geometry models unavailable", outcome),
            ));
            Vec::new()
        }
    }
}

async fn select_models(
    host: &HomeFeedHost,
    keys: Vec<String>,
) -> StorageOutcome<Vec<RowGeometryModel>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
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
