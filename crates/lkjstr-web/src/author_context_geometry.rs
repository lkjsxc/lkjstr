use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, EventDisplayContext, FeedDiagnosticSeverity,
    FeedWindowState, RowGeometryModel,
};
use lkjstr_storage::StorageOutcome;

use crate::{
    author_context_host::AuthorContextHost,
    feed_geometry_models::feed_geometry_models,
    host_status::problem_status,
};

pub(crate) async fn author_context_geometry_models(
    host: &AuthorContextHost,
    window: &FeedWindowState,
    diagnostics: &mut Vec<AuthorContextFeedDiagnosticInput>,
    width_px: u16,
    font_scale: f32,
) -> Vec<RowGeometryModel> {
    match feed_geometry_models(
        &host.db_name,
        &host.worker_url,
        window,
        EventDisplayContext::AuthorContext,
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

fn diagnostic(id: &str, message: &str) -> AuthorContextFeedDiagnosticInput {
    AuthorContextFeedDiagnosticInput {
        scope: "author-context-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}
