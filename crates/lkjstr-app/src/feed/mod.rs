#![doc = "Pure feed runtime reducers."]

mod author_context_inputs;
mod reducer;
mod runtime;
mod runtime_types;
mod surface_input_types;
mod surface_inputs;
mod thread_inputs;
mod tool_inputs;
mod top_anchor;
mod types;
mod view_model;

pub use author_context_inputs::{author_context_anchor_input, author_context_nearby_input};
pub use reducer::{empty_feed_window, feed_window_empty_ready, reduce_feed_window};
pub use runtime::{
    attach_feed_runtime_live, reduce_feed_runtime_window, release_feed_runtime_live,
    set_feed_runtime_visibility, start_feed_runtime,
};
pub use runtime_types::{
    FeedRuntimeInput, FeedRuntimeLeaseOutcome, FeedRuntimeLiveOutcome, FeedRuntimeState,
};
pub use surface_input_types::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, CustomRequestQueryInput,
    FeedLiveQueryInput, NotificationsLiveQueryInput, ProfileLiveQueryInput, SearchQueryInput,
    ThreadRepliesQueryInput, ThreadRootLookupInput,
};
pub use surface_inputs::{
    global_live_query_input, home_live_query_input, notifications_live_query_input,
    profile_live_query_input, user_timeline_live_query_input,
};
pub use thread_inputs::{thread_replies_query_input, thread_root_lookup_input};
pub use tool_inputs::{custom_request_query_input, search_query_input};
pub use top_anchor::{
    NewestCursorPolicy, TopAnchorAction, TopAnchorDecision, TopAnchorInput, decide_top_anchor,
};
pub use types::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, FeedWindowStatus,
};
pub use view_model::{
    FEED_LOAD_OLDER_COMMAND, FeedContinuationRow, FeedDiagnosticRow, FeedDiagnosticSeverity,
    FeedEventContent, FeedEventContentRow, FeedEventCustomEmoji, FeedEventLink,
    FeedEventMediaAttachment, FeedEventMediaKind, FeedEventProfileMention, FeedEventReferenceKind,
    FeedEventReferenceUnavailable, FeedEventRow, FeedEventUnavailablePreview, FeedFooterRow,
    FeedFooterState, FeedNotificationRow, FeedProfileRow, FeedRowRenderer, FeedStateRow,
    FeedUnavailableRow, FeedViewModel, FeedViewModelInput, FeedViewRow, build_feed_view_model,
    diagnostic_state_row, feed_continuation_row_id, feed_diagnostic_row_id, feed_event_content,
    feed_event_content_rows, feed_event_geometry_model_keys, feed_event_row_id, feed_footer_row_id,
    feed_notification_row_id, feed_profile_row_id, feed_unavailable_row_id, footer_row,
    footer_row_from_window, notification_state_row, plan_feed_event_content, profile_state_row,
    unavailable_state_row,
};
