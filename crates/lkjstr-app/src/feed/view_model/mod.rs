#![doc = "Pure shared feed row view-model data."]

mod build;
mod content;
#[cfg(test)]
mod content_link_tests;
#[cfg(test)]
mod content_media_tests;
#[cfg(test)]
mod content_profile_mention_tests;
#[cfg(test)]
mod content_reference_tests;
mod content_row;
#[cfg(test)]
mod content_tests;
mod geometry;
mod ids;
mod link_rows;
mod media_rows;
mod profile_mention_rows;
mod reference_rows;
mod types;

pub use build::{
    FeedViewModelInput, build_feed_view_model, diagnostic_state_row, footer_row,
    footer_row_from_window, notification_state_row, profile_state_row, unavailable_state_row,
};
pub use content::{
    FeedEventContent, feed_event_content, feed_event_content_rows, plan_feed_event_content,
};
pub use content_row::{
    FeedEventContentRow, FeedEventCustomEmoji, FeedEventLink, FeedEventMediaAttachment,
    FeedEventMediaKind, FeedEventProfileMention, FeedEventReferenceKind,
    FeedEventReferenceUnavailable, FeedEventUnavailablePreview,
};
pub use geometry::feed_event_geometry_model_keys;
pub use ids::{
    feed_continuation_row_id, feed_diagnostic_row_id, feed_event_row_id, feed_footer_row_id,
    feed_notification_row_id, feed_profile_row_id, feed_unavailable_row_id,
};
pub use types::{
    FEED_LOAD_OLDER_COMMAND, FeedContinuationRow, FeedDiagnosticRow, FeedDiagnosticSeverity,
    FeedEventRow, FeedFooterRow, FeedFooterState, FeedNotificationRow, FeedProfileRow,
    FeedRowRenderer, FeedStateRow, FeedUnavailableRow, FeedViewModel, FeedViewRow,
};
