use lkjstr_app::{EventDisplayContext, FeedWindowState, RowGeometryModel};
use lkjstr_storage::StorageOutcome;

use crate::feed_geometry_models::feed_geometry_models;

pub(crate) async fn custom_request_geometry_models(
    db_name: &str,
    worker_url: &str,
    window: &FeedWindowState,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        db_name,
        worker_url,
        window,
        EventDisplayContext::CustomRequest,
        width_px,
        font_scale,
    )
    .await
    {
        StorageOutcome::Ok(models) => models,
        _ => Vec::new(),
    }
}
