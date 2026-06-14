use lkjstr_app::{
    EventDisplayContext, FeedWindowState, NotificationsFeedDiagnosticInput, RowGeometryModel,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
    notifications_feed_host::NotificationsFeedHost,
    notifications_feed_host_diagnostics::diagnostic,
};

pub(crate) async fn notifications_feed_geometry_models(
    host: &NotificationsFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<NotificationsFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::Notification,
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
