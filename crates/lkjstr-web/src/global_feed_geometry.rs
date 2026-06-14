use lkjstr_app::{
    EventDisplayContext, FeedWindowState, GlobalFeedDiagnosticInput, RowGeometryModel,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    global_feed_host::{GlobalFeedHost, diagnostic},
    host_status::problem_status,
};

pub(crate) async fn global_feed_geometry_models(
    host: &GlobalFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<GlobalFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::Timeline,
        width_px,
        font_scale,
    )
    .await
    {
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
