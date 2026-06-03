#![doc = "Pure application composition reducers for lkjstr."]

pub mod custom_request;
pub mod feed;
pub mod feed_scan;
pub mod query;
mod startup_snapshots;
mod workspace_defaults;
pub mod workspace_runtime;

pub use custom_request::{
    CustomRequest, CustomRequestError, CustomRequestErrorKind, CustomRequestMode,
    custom_request_mode, parse_custom_request,
};
pub use feed::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, CustomRequestQueryInput,
    FeedLiveQueryInput, FeedRuntimeInput, FeedRuntimeLeaseOutcome, FeedRuntimeLiveOutcome,
    FeedRuntimeState, FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState,
    FeedWindowStatus, NotificationsLiveQueryInput, ProfileLiveQueryInput, SearchQueryInput,
    ThreadRepliesQueryInput, ThreadRootLookupInput, attach_feed_runtime_live,
    author_context_anchor_input, author_context_nearby_input, custom_request_query_input,
    empty_feed_window, feed_window_empty_ready, global_live_query_input, home_live_query_input,
    notifications_live_query_input, profile_live_query_input, reduce_feed_runtime_window,
    reduce_feed_window, release_feed_runtime_live, search_query_input, set_feed_runtime_visibility,
    start_feed_runtime, thread_replies_query_input, thread_root_lookup_input,
};
pub use feed_scan::{
    CoverageGap, CursorPoint, DEFAULT_HINT_TTL_SECONDS, DEFAULT_INITIAL_SPAN_SECONDS,
    DEFAULT_MAX_SPAN_SECONDS, DEFAULT_MIN_SPAN_SECONDS, FeedScanHint, FeedScanPlan,
    FeedScanPlanInput, FeedScanTrace, FeedbackCounts, HintCompatibility, HintContext,
    MAX_SEGMENTS_PER_PLAN, ScanDirection, ScanFeedbackUpdate, ScanPlanDiagnostic, ScanPlanSource,
    ScanSegment, ScanWindowFeedback, SegmentSplitOutcome, feed_scan_trace, hint_context,
    next_span_for_feedback, plan_feed_scan, reduce_scan_feedback, scan_hint_proves_cache_absence,
    segment_from_edge, should_query_uncovered_relay, split_limit_hit_segment,
};
pub use query::{QueryDemandInput, QueryDemandPlan, QuerySurface, plan_query_demand};
pub use workspace_runtime::{
    DEFAULT_WARM_SNAPSHOT_CAP, StartupInput, StartupResult, StartupSource, WorkspaceRuntimeState,
    close_runtime_tab, convert_runtime_tab, default_recovery_ids, focus_runtime_tab,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "app";
