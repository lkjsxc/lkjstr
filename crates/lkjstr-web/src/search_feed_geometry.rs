use lkjstr_app::{
    EventDisplayContext, FeedWindowState, RowGeometryModel, SearchFeedDiagnosticInput,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
    search_feed_host::{SearchFeedHost, diagnostic},
};

pub(crate) async fn search_feed_geometry_models(
    host: &SearchFeedHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<SearchFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::Search,
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
