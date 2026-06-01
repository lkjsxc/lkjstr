#![doc = "Pure relay runtime state machines for lkjstr."]

pub mod client;
pub mod close_tombstones;
pub mod demand;
pub mod ingress;
pub mod page_read;
pub mod request_budget;
pub mod request_message_size;
pub mod request_scheduler;
pub mod route_plan;
pub mod send_queue;
pub mod subscription_alias;
pub mod subscription_id;

pub use client::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayClientState,
    RelayConnectionState, RelayMessageState, RelayTimerKind, connect_deadline_ms,
    max_relay_message_records, reconnect_delay_ms, reduce_relay_client,
};
pub use close_tombstones::{RelayCloseTombstones, default_close_tombstone_ttl_ms};
pub use demand::{
    Demand, DemandAttachAction, DemandAttachOutcome, DemandDetachAction, DemandDetachOutcome,
    DemandLeaseRegistry, DemandLeaseSnapshot, DemandPhase, DemandPriority, DemandPurpose,
    DemandRegistryCounts, DemandSurface, DemandVisibility, DemandVisibilityAction,
    DemandVisibilityOutcome, DemandWireRequest, canonical_filters_key, canonical_relays,
    canonical_relays_key, default_demand_staleness_ms, demand_lease_key, demand_to_wire_request,
    lease_key_from_fingerprint, normalized_demand_filters, wire_equivalent_fingerprint,
};
pub use ingress::{
    IngressDecision, ingress_decision, is_feed_display_kind, is_notification_kind,
    is_render_critical_for_surface,
};
pub use page_read::{
    FeedCursorPoint, InFlightPageReadCounts, InFlightPageReadRegistry, InitialProgressiveRead,
    PageReadAbortOutcome, PageReadAttachAction, PageReadAttachOutcome, PageReadAttachment,
    PageReadBounds, PageReadCleanup, PageReadDirection, PageReadIntent, PageReadPhase,
    PageReadPurpose, PageReadSettleOutcome, PageReadSurface, ProgressiveEvent,
    ProgressiveReadEvidence, ProgressiveReadSnapshot, ProgressiveReadState, ProgressiveReadStatus,
    ProgressiveRelaySnapshot, ProgressiveRelayState, ReadDedupeOptions, ReadPageRelayStatus,
    RelayReadRequest, RelayRouteGroup, event_relays, initial_progressive_read, page_read_bounds,
    page_read_semantic_key, progressive_read_snapshot, progressive_status, read_dedupe_key,
    reduce_progressive_read, relay_snapshot_from_status, route_group_fingerprint, subscription_key,
};
pub use request_budget::{
    BudgetedFilters, MergedReadBudget, RequestBudget, RequestBudgetDirection, RequestBudgetInput,
    RequestBudgetPhase, RequestBudgetPurpose, RequestBudgetSurface, RequestBudgetWarning,
    RequestBudgetWarningKind, RequestBudgetWarningValue, RequestRelayLimits, app_filter_cap,
    apply_budget_to_filters, default_read_page_max_events, derive_request_budget,
    intended_filter_limit, max_exact_lookup_limit, max_filter_limit, max_metadata_limit,
    max_route_discovery_limit, max_search_limit, merge_budgets_for_read, positive_limit,
    request_timeout_ms,
};
pub use request_message_size::{
    RequestMessageSizeCapSource, RequestMessageSizeDecision, RequestMessageSizeWarning,
    app_max_req_message_bytes, estimate_req_message_bytes, request_message_size_decision,
};
pub use request_scheduler::{
    PendingReq, RelayReqScheduler, ReleaseOutcome, ScheduleOutcome, max_pending_relay_reqs,
};
pub use route_plan::{
    AuthorRelayRoute, RelayRoutePlan, RouteEvidenceSource, RoutePlanDiagnostic,
    RoutePlanDiagnosticKind, RoutePlanGroup, RoutePlanGroupSource, RoutePlanInput,
    RoutePlanSurface, default_max_authors_per_route_group, default_max_route_relays_per_author,
    default_max_targeted_route_groups, plan_relay_routes,
};
pub use send_queue::{RelaySendQueue, max_relay_queued_messages};
pub use subscription_alias::RelaySubscriptionAliases;
pub use subscription_id::{
    child_relay_subscription_id, compact_relay_subscription_id, initial_relay_subscription_id,
    live_relay_subscription_id, max_relay_subscription_id_length, newer_relay_subscription_id,
    older_relay_subscription_id, relay_subscription_hash, relay_subscription_id_valid,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "relays";
