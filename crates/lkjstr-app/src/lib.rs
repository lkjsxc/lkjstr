pub mod author_context_feed;
pub mod cache_display;
pub mod custom_request;
pub mod custom_request_feed;
pub mod events;
pub mod feed;
pub mod feed_fragments;
pub mod feed_geometry;
pub mod feed_lod;
pub mod feed_policy;
pub mod feed_scan;
pub mod feed_wait;
pub mod follow_graph;
pub mod global_feed;
pub mod home_feed;
pub mod hydration_priority;
pub mod notifications_feed;
pub mod orchestration;
pub mod profile_feed;
pub mod profile_history;
pub mod protected_account;
pub mod public_chat;
pub mod query;
pub mod read_availability;
pub mod search_feed;
mod startup_snapshots;
pub mod storage_maintenance;
pub mod thread_feed;
pub mod user_timeline;
mod workspace_defaults;
pub mod workspace_runtime;
pub use author_context_feed::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedStatus,
    AuthorContextFeedView, AuthorContextFeedViewInput, author_context_feed_id,
    build_author_context_feed_view, default_author_context_feed_view,
};
pub use cache_display::{
    CacheDisplayEvidence, CacheDisplayMode, cache_display_policy, complete_cache_display,
};
pub use custom_request::{
    CustomRequest, CustomRequestError, CustomRequestErrorKind, CustomRequestLimitClamp,
    CustomRequestMode, CustomRequestRunInput, CustomRequestRunPlan, CustomRequestRunStatus,
    custom_request_mode, parse_custom_request, plan_custom_request_run,
};
pub use custom_request_feed::{
    CustomRequestFeedSourceState, CustomRequestFeedStatus, CustomRequestFeedView,
    CustomRequestFeedViewInput, build_custom_request_feed_view, canceled_custom_request_feed_view,
    custom_request_feed_id, default_custom_request_feed_view, planning_custom_request_feed_view,
    unavailable_custom_request_feed_view,
};
pub use events::{
    EventDisplayCapabilities, EventDisplayChromePolicy, EventDisplayContext, EventDisplayInput,
    EventDisplayPlan, EventDisplayRenderer, plan_event_display, plan_repost_target_display,
};
pub use feed::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, CustomRequestQueryInput,
    FEED_LOAD_OLDER_COMMAND, FeedContinuationRow, FeedDiagnosticRow, FeedDiagnosticSeverity,
    FeedEventRow, FeedFooterRow, FeedFooterState, FeedLiveQueryInput, FeedNotificationRow,
    FeedProfileRow, FeedRowRenderer, FeedRuntimeInput, FeedRuntimeLeaseOutcome,
    FeedRuntimeLiveOutcome, FeedRuntimeState, FeedShellRow, FeedStateRow, FeedUnavailableRow,
    FeedViewModel, FeedViewModelInput, FeedViewRow, FeedWindowCursor, FeedWindowEvidence,
    FeedWindowFlags, FeedWindowState, FeedWindowStatus, NewestCursorPolicy,
    NotificationsLiveQueryInput, ProfileLiveQueryInput, SearchQueryInput, ThreadRepliesQueryInput,
    ThreadRootLookupInput, TopAnchorAction, TopAnchorDecision, TopAnchorInput,
    attach_feed_runtime_live, author_context_anchor_input, author_context_nearby_input,
    build_feed_view_model, custom_request_query_input, decide_top_anchor, diagnostic_state_row,
    empty_feed_window, feed_continuation_row_id, feed_diagnostic_row_id,
    feed_event_geometry_model_keys, feed_event_row_id, feed_footer_row_id,
    feed_notification_row_id, feed_profile_row_id, feed_unavailable_row_id,
    feed_window_empty_ready, footer_row, footer_row_from_window, global_live_query_input,
    home_live_query_input, notification_state_row, notifications_live_query_input,
    profile_live_query_input, profile_state_row, reduce_feed_runtime_window, reduce_feed_window,
    release_feed_runtime_live, search_query_input, set_feed_runtime_visibility, start_feed_runtime,
    thread_replies_query_input, thread_root_lookup_input, unavailable_state_row,
    user_timeline_live_query_input,
};
pub use feed_fragments::{
    FeedFragmentConfig, FeedVisualRow, SemanticFeedEvent, fragment_key, plan_feed_visual_rows,
    split_text_segments,
};
pub use feed_geometry::{
    AnchorCompensation, AnchorConfidence, AnchorReconcileResult, ContentShapeInput,
    FeedScrollAnchor, GeometryAction, GeometryConfidence, GeometryEstimateSource, GeometryKey,
    MaterializationTier, MeasuredFeedRow, ReservedHeightDecision, ReservedHeightReason,
    RowGeometryEstimate, RowGeometryFeatures, RowGeometryModel, RowGeometryState,
    RowHeightObservation, RowKind, WidthBucket, anchor_compensation_for_height_delta,
    capture_feed_anchor, content_shape_hash, estimate_row_geometry, event_geometry_features,
    geometry_bucket_key, next_reserved_height, reconcile_feed_anchor, update_row_geometry_model,
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
    FolloweesDiagnostic, FolloweesProfile, FolloweesRow, FolloweesStatus, FolloweesView,
    FolloweesViewInput, TargetFollowListState, UserTimelineAuthorSet, author_set_hash,
    build_followees_view, chunk_author_set, default_followees_view, follow_count_label,
    followees_retryable_failure_view, followees_status_message, followees_view_from_summary,
    followees_view_from_summary_with_profiles, reduce_follow_count, summarize_follow_list,
    target_posts_only_author_set, user_timeline_author_set,
};
pub use global_feed::{
    GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS, GlobalFeedDiagnosticInput, GlobalFeedSourceState,
    GlobalFeedStatus, GlobalFeedView, GlobalFeedViewInput, GlobalHistoryExhaustion,
    GlobalOlderBlockReason, GlobalOlderIntent, GlobalOlderIntentInput, GlobalOlderLoadTrigger,
    GlobalOlderPageInput, GlobalOlderPageOutcome, GlobalRelayCursor, build_global_feed_view,
    default_global_feed_view, global_cursor_contains, global_feed_id, older_global_cursor,
    plan_global_older_intent, plan_global_older_page,
};
pub use home_feed::{
    HomeFeedDiagnosticInput, HomeFeedSourceState, HomeFeedStatus, HomeFeedView, HomeFeedViewInput,
    HomeFollowState, build_home_feed_view, default_home_feed_view, home_authors, home_feed_id,
};
pub use hydration_priority::{HydrationJob, HydrationPriority, plan_hydration_jobs};
pub use notifications_feed::{
    NOTIFICATION_CLOCK_SKEW_SECONDS, NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS,
    NotificationItemInput, NotificationRelayCursor, NotificationsFeedDiagnosticInput,
    NotificationsFeedSourceState, NotificationsFeedStatus, NotificationsFeedView,
    NotificationsFeedViewInput, NotificationsHistoryExhaustion, NotificationsOlderBlockReason,
    NotificationsOlderIntent, NotificationsOlderIntentInput, NotificationsOlderLoadTrigger,
    NotificationsOlderPageInput, NotificationsOlderPageOutcome, build_notifications_feed_view,
    default_notifications_feed_view, initial_notification_cursor, notification_cursor_contains,
    notifications_feed_id, older_notification_cursor, plan_notifications_older_intent,
    plan_notifications_older_page,
};
pub use orchestration::{
    CacheReadMode, CoverageEvidenceState, FeedPrefetchPlan, HydrationPlan, OptimizerEvidenceState,
    OrchestrationContext, OrchestrationDecisionTrace, OrchestrationPolicy, RetentionHintPlan,
    SurfaceKind, SurfaceReadPlan, plan_cache_retention, plan_feed_prefetch, plan_hydration,
    plan_surface_read,
};
pub use profile_feed::{
    ProfileFeedDiagnosticInput, ProfileFeedSourceState, ProfileFeedStatus, ProfileFeedView,
    ProfileFeedViewInput, ProfileHeaderInput, ProfileHeaderView, build_profile_feed_view,
    default_profile_feed_view, profile_feed_id, profile_header_view,
    profile_header_with_copy_context, profile_header_with_relays, profile_npub,
    relay_sets_copy_json,
};
pub use profile_history::{ProfileScanDecision, ProfileScanInput, plan_profile_sparse_scan};
pub use protected_account::ProtectedAccountAvailability;
pub use public_chat::{
    PublicChatPublishTemplate, PublicChatQueryInput, PublicChatReadPlan, channel_discovery_plan,
    channel_message_template, channel_metadata_plan, channel_reply_template,
    create_channel_template, hide_message_template, mute_user_template, own_hide_plan,
    own_mute_plan, route_relays, selected_channel_messages_plan, update_channel_metadata_template,
};
pub use query::{QueryDemandInput, QueryDemandPlan, QuerySurface, plan_query_demand};
pub use search_feed::{
    SearchFeedDiagnosticInput, SearchFeedSourceState, SearchFeedStatus, SearchFeedView,
    SearchFeedViewInput, build_search_feed_view, default_search_feed_view,
    partial_search_feed_view, pending_search_feed_view, search_feed_id,
};
pub use storage_maintenance::{
    StorageMaintenanceInput, StorageMaintenancePlan, StorageRepairConsumption,
    plan_storage_maintenance,
};
pub use thread_feed::{
    THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS, ThreadFeedDiagnosticInput, ThreadFeedSourceState,
    ThreadFeedStatus, ThreadFeedView, ThreadFeedViewInput, ThreadHistoryExhaustion,
    ThreadOlderBlockReason, ThreadOlderIntent, ThreadOlderIntentInput, ThreadOlderLoadTrigger,
    ThreadOlderPageInput, ThreadOlderPageOutcome, ThreadRelayCursor, build_thread_feed_view,
    default_thread_feed_view, older_thread_cursor, plan_thread_older_intent,
    plan_thread_older_page, thread_cursor_contains, thread_feed_id,
};
pub use user_timeline::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, UserTimelineDiscoveryInput,
    UserTimelineDiscoveryPlan, UserTimelineDiscoveryState, UserTimelineFeedDiagnosticInput,
    UserTimelineFeedSourceState, UserTimelineFeedStatus, UserTimelineFeedView,
    UserTimelineFeedViewInput, build_user_timeline_feed_view, default_user_timeline_feed_view,
    plan_user_timeline_discovery, user_timeline_feed_id, user_timeline_target_only_notice,
};
pub use workspace_runtime::{
    DEFAULT_WARM_SNAPSHOT_CAP, StartupInput, StartupResult, StartupSource, WorkspaceRuntimeState,
    close_runtime_tab, convert_runtime_tab, default_recovery_ids, focus_runtime_tab,
    open_configured_runtime_tab, open_runtime_tab, record_tab_snapshot, start_workspace,
};
