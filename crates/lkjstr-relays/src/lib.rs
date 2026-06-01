#![doc = "Pure relay runtime state machines for lkjstr."]

pub mod close_tombstones;
pub mod request_message_size;
pub mod request_scheduler;
pub mod send_queue;
pub mod subscription_alias;
pub mod subscription_id;

pub use close_tombstones::{RelayCloseTombstones, default_close_tombstone_ttl_ms};
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
