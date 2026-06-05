#![doc = "Pure application composition reducers for lkjstr."]

pub mod custom_request;
pub mod feed;
pub mod feed_geometry;
pub mod feed_lod;
pub mod feed_scan;
pub mod feed_wait;
pub mod follow_graph;
pub mod orchestration;
pub mod public_chat;
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
    FeedWindowStatus, NewestCursorPolicy, NotificationsLiveQueryInput, ProfileLiveQueryInput,
    SearchQueryInput, ThreadRepliesQueryInput, ThreadRootLookupInput, TopAnchorAction,
    TopAnchorDecision, TopAnchorInput, attach_feed_runtime_live, author_context_anchor_input,
    author_context_nearby_input, custom_request_query_input, decide_top_anchor, empty_feed_window,
    feed_window_empty_ready, global_live_query_input, home_live_query_input,
    notifications_live_query_input, profile_live_query_input, reduce_feed_runtime_window,
    reduce_feed_window, release_feed_runtime_live, search_query_input, set_feed_runtime_visibility,
    start_feed_runtime, thread_replies_query_input, thread_root_lookup_input,
};
pub use feed_geometry::{
    AnchorCompensation, GeometryEstimateSource, RowGeometryEstimate, RowGeometryFeatures,
    RowGeometryModel, RowHeightObservation, RowKind, WidthBucket,
    anchor_compensation_for_height_delta, estimate_row_geometry, geometry_bucket_key,
    update_row_geometry_model,
};
pub use feed_lod::{
    CoverageProjection, FeedLodBlock, FeedLodRow, FeedLodRowKind, FeedLodTree, MaterializationPlan,
    RowCoverageState, RowLocation, RowRange, TreeUpdate, build_lod_tree, coverage_gap_projection,
    height_delta_update, materialization_plan, offset_to_row, visible_range,
};
pub use feed_scan::{
    CoverageGap, CursorPoint, DEFAULT_HINT_TTL_SECONDS, DEFAULT_INITIAL_SPAN_SECONDS,
    DEFAULT_MAX_SINGLE_CHANGE_FACTOR, DEFAULT_MAX_SPAN_SECONDS, DEFAULT_MIN_SPAN_SECONDS,
    DEFAULT_MINIMUM_DENSITY_PER_SECOND, DEFAULT_STALE_HALF_LIFE_SECONDS,
    DEFAULT_TARGET_LIMIT_DENOMINATOR, DEFAULT_TARGET_LIMIT_NUMERATOR, FeedScanHint, FeedScanPlan,
    FeedScanPlanInput, FeedScanTrace, FeedbackCounts, HintCompatibility, HintContext,
    MAX_SEGMENTS_PER_PLAN, ScanDensityModel, ScanDirection, ScanFeedbackUpdate, ScanModelContext,
    ScanModelKey, ScanModelScope, ScanPlanDiagnostic, ScanPlanSource, ScanSegment,
    ScanSegmentObservation, ScanSpanConfig, ScanWindowFeedback, SegmentSplitOutcome, SpanCapReason,
    SpanProposal, decayed_sample_weight, feed_scan_trace, hint_context, model_matches_context,
    next_span_for_feedback, plan_feed_scan, propose_scan_span, reduce_scan_feedback,
    reduce_scan_observation, scan_hint_proves_cache_absence, scan_model_context,
    scan_model_from_observation, scan_model_key_for_scope, scan_model_keys_for_context,
    scan_model_scope_order, segment_from_edge, select_models_for_context,
    should_query_uncovered_relay, split_limit_hit_segment, update_scan_density_model,
};
pub use feed_wait::{
    CONTEXT_UNAVAILABLE_WAIT_MS, EmptyProofInput, FIRST_PAINT_DELAY_MS, FOREGROUND_MERGE_WINDOW_MS,
    FeedWaitDecision, FeedWaitEventRow, FeedWaitInput, FeedWaitState, LateMergeResult,
    ScrollAnchor, ScrollAnchorDecision, decide_feed_wait, feed_empty_is_terminal,
    merge_late_event_rows, scroll_anchor_for_late_insert, within_foreground_merge_window,
};
pub use follow_graph::{
    FollowCountEvidence, FollowCountState, FollowListReadPhase, FollowListSummary,
    TargetFollowListState, UserTimelineAuthorSet, author_set_hash, follow_count_label,
    reduce_follow_count, summarize_follow_list, target_posts_only_author_set,
    user_timeline_author_set,
};
pub use orchestration::{
    CacheReadMode, CoverageEvidenceState, FeedPrefetchPlan, HydrationPlan, OptimizerEvidenceState,
    OrchestrationContext, OrchestrationDecisionTrace, OrchestrationPolicy, RetentionHintPlan,
    SurfaceKind, SurfaceReadPlan, plan_cache_retention, plan_feed_prefetch, plan_hydration,
    plan_surface_read,
};
pub use public_chat::{
    PublicChatPublishTemplate, PublicChatQueryInput, PublicChatReadPlan, channel_discovery_plan,
    channel_message_template, channel_metadata_plan, channel_reply_template,
    create_channel_template, hide_message_template, mute_user_template, own_hide_plan,
    own_mute_plan, route_relays, selected_channel_messages_plan, update_channel_metadata_template,
};
pub use query::{QueryDemandInput, QueryDemandPlan, QuerySurface, plan_query_demand};
pub use workspace_runtime::{
    DEFAULT_WARM_SNAPSHOT_CAP, StartupInput, StartupResult, StartupSource, WorkspaceRuntimeState,
    close_runtime_tab, convert_runtime_tab, default_recovery_ids, focus_runtime_tab,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "app";
