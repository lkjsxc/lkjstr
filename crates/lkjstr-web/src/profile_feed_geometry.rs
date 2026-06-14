use lkjstr_app::{
    EventDisplayContext, FeedWindowState, ProfileFeedDiagnosticInput, RowGeometryModel,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
    profile_feed_host::ProfileFeedHost,
    profile_feed_status::diagnostic,
};

pub(crate) async fn profile_feed_geometry_models(
    host: &ProfileFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<ProfileFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::Profile,
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
