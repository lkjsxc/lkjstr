use lkjstr_app::{
    EventDisplayContext, FeedWindowState, RowGeometryModel, UserTimelineFeedDiagnosticInput,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
    user_timeline_host::UserTimelineHost,
    user_timeline_host_view::diagnostic,
};

pub(crate) async fn user_timeline_geometry_models(
    host: &UserTimelineHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<UserTimelineFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::UserTimeline,
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
