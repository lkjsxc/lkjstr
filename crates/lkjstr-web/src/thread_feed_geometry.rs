use lkjstr_app::{
    EventDisplayContext, FeedWindowState, RowGeometryModel, ThreadFeedDiagnosticInput,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
    thread_feed_host::ThreadFeedHost,
    thread_feed_status::diagnostic,
};

pub(crate) async fn thread_feed_geometry_models(
    host: &ThreadFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<ThreadFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::Thread,
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
