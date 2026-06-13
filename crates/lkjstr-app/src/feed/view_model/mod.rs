#![doc = "Pure shared feed row view-model data."]

mod build;
mod ids;
mod types;

pub use build::{
    FeedViewModelInput, build_feed_view_model, diagnostic_state_row, footer_row,
    footer_row_from_window, notification_state_row, profile_state_row, unavailable_state_row,
};
pub use ids::{
    feed_continuation_row_id, feed_diagnostic_row_id, feed_event_row_id, feed_footer_row_id,
    feed_notification_row_id, feed_profile_row_id, feed_unavailable_row_id,
};
pub use types::{
    FEED_LOAD_OLDER_COMMAND, FeedContinuationRow, FeedDiagnosticRow, FeedDiagnosticSeverity,
    FeedEventRow, FeedFooterRow, FeedFooterState, FeedNotificationRow, FeedProfileRow,
    FeedRowRenderer, FeedStateRow, FeedUnavailableRow, FeedViewModel, FeedViewRow,
};
