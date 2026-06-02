#![doc = "Pure application composition reducers for lkjstr."]

pub mod custom_request;
pub mod feed;
pub mod query;
mod startup_snapshots;
mod workspace_defaults;
pub mod workspace_runtime;

pub use custom_request::{
    CustomRequest, CustomRequestError, CustomRequestErrorKind, CustomRequestMode,
    custom_request_mode, parse_custom_request,
};
pub use feed::{
    CustomRequestQueryInput, FeedLiveQueryInput, FeedRuntimeInput, FeedRuntimeLeaseOutcome,
    FeedRuntimeLiveOutcome, FeedRuntimeState, FeedWindowCursor, FeedWindowEvidence,
    FeedWindowFlags, FeedWindowState, FeedWindowStatus, NotificationsLiveQueryInput,
    ProfileLiveQueryInput, SearchQueryInput, attach_feed_runtime_live, custom_request_query_input,
    empty_feed_window, feed_window_empty_ready, global_live_query_input, home_live_query_input,
    notifications_live_query_input, profile_live_query_input, reduce_feed_runtime_window,
    reduce_feed_window, release_feed_runtime_live, search_query_input, set_feed_runtime_visibility,
    start_feed_runtime,
};
pub use query::{QueryDemandInput, QueryDemandPlan, QuerySurface, plan_query_demand};
pub use workspace_runtime::{
    DEFAULT_WARM_SNAPSHOT_CAP, StartupInput, StartupResult, StartupSource, WorkspaceRuntimeState,
    close_runtime_tab, convert_runtime_tab, default_recovery_ids, focus_runtime_tab,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "app";
