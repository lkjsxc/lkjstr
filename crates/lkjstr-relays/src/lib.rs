#![doc = "Pure relay runtime state machines for lkjstr."]

pub mod client;
pub mod close_tombstones;
pub mod page_read;
pub mod request_budget;
pub mod request_message_size;
pub mod request_scheduler;
pub mod send_queue;
pub mod subscription_alias;
pub mod subscription_id;

pub use client::{
    RelayClientDiagnosticKind, RelayClientEffect, RelayClientEvent, RelayClientState,
    RelayConnectionState, RelayMessageState, RelayTimerKind, connect_deadline_ms,
    max_relay_message_records, reconnect_delay_ms, reduce_relay_client,
};
pub use close_tombstones::{RelayCloseTombstones, default_close_tombstone_ttl_ms};
pub use page_read::{
    FeedCursorPoint, InitialProgressiveRead, PageReadBounds, PageReadDirection, PageReadIntent,
    PageReadPhase, PageReadPurpose, PageReadSurface, ProgressiveEvent, ProgressiveReadEvidence,
    ProgressiveReadSnapshot, ProgressiveReadState, ProgressiveReadStatus, ProgressiveRelaySnapshot,
    ProgressiveRelayState, ReadDedupeOptions, ReadPageRelayStatus, RelayReadRequest,
    RelayRouteGroup, event_relays, initial_progressive_read, page_read_bounds,
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
pub use send_queue::{RelaySendQueue, max_relay_queued_messages};
pub use subscription_alias::RelaySubscriptionAliases;
pub use subscription_id::{
    child_relay_subscription_id, compact_relay_subscription_id, initial_relay_subscription_id,
    live_relay_subscription_id, max_relay_subscription_id_length, newer_relay_subscription_id,
    older_relay_subscription_id, relay_subscription_hash, relay_subscription_id_valid,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "relays";
