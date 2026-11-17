//! Bounded relay scheduler. Time is supplied by the host, including in tests.
use super::protocol::{Output, Query, Source};
use lkjstr_protocol::{NostrEvent, NostrFilter, filter_to_value, normalize_relay_url};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
#[path = "network_auth.rs"]
pub mod auth;
#[path = "network_batch.rs"]
mod batch;
#[path = "network_cancel.rs"]
mod cancellation;
#[path = "network_config.rs"]
mod configuration;
#[path = "network_count_routes.rs"]
mod count_routes;
#[path = "network_delivery.rs"]
mod delivery;
#[path = "network_delivery_checks.rs"]
mod delivery_checks;
#[path = "network_lifecycle.rs"]
mod lifecycle;
#[path = "network_lists.rs"]
mod lists;
#[path = "network_messages.rs"]
mod messages;
#[path = "network_stats.rs"]
mod observations;
#[path = "network_paging.rs"]
mod paging;
#[path = "network_plan.rs"]
mod planning;
#[path = "request_policy.rs"]
mod policy;
#[path = "network_profiles.rs"]
mod profiles;
#[path = "network_publication_history.rs"]
mod publication_history;
#[path = "network_publications.rs"]
mod publications;
#[path = "network_quality.rs"]
mod quality;
#[path = "network_observations.rs"]
mod routing_observations;
#[path = "network_tick.rs"]
mod scheduler;
#[path = "network_union.rs"]
mod union;
#[path = "network_verification.rs"]
mod verification;
#[path = "read_want_key.rs"]
pub(in crate::engine) mod want_key;
use scheduler::filter_live;
#[path = "read_plan.rs"]
pub mod read_plan;
type Desired = BTreeMap<(String, String), (NostrFilter, BTreeSet<String>)>;
#[derive(Debug, Clone)]
pub enum Effect {
    Inspect(String),
    Connect(String),
    Disconnect(String),
    Send(String, String),
}
#[derive(Default)]
pub struct Relay {
    pub(super) auth: auth::Authentication,
    pub cooldown_until: u64,
    pub quality_at: u64,
    pub prior_useful: u64,
    pub prior_received: u64,
    pub online: bool,
    pub connecting: bool,
    pub last_rx: u64,
    pub retry_at: u64,
    pub failures: u32,
    pub received: u64,
    pub duplicates: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub connected_since: Option<u64>,
    pub last_error: Option<String>,
    pub useful: u64,
    pub sent: u64,
    pub max_reqs: usize,
    pub max_filters: usize,
    pub single_filters: bool, // A rejected envelope disables capability inference.
    pub max_limit: u64,
    pub nip11: bool,
    pub next_req_at: u64,
    pub latency_ms: Option<u64>,
}
pub(super) struct Request {
    pub relay: String,
    pub wire_id: String,
    pub purpose: &'static str,
    pub priority: u8,
    pub weight: u64,
    pub filter: NostrFilter,
    pub page_filter: NostrFilter, // Logical union, independent of the route cursor.
    pub members: BTreeSet<String>,
    pub read_slot: bool, // Owns an ordinary reader slot; recovery routes remain separate.
    pub verification_retry: bool, // Local queue loss: replay this span after backlog drains.
    pub sent: bool,
    pub eose: bool,
    pub page_eose: bool, // Historical completion survives live resubscription.
    pub deadline: u64,
    pub initial_deadline: u64, // Count deferral ends even if the page keeps retrying.
    pub last_event: Option<u64>,
    pub sent_at: u64,
    pub last_rx: u64,
    pub complete: bool,
    pub live: bool,
    pub union_safe: bool, // Only public, independently revocable view wants may share live envelopes.
    pub list_watch: bool, // Visible TheirHome watch, even when shared with account discovery.
    pub asked: bool,
    pub ready_at: u64,
    // At most the transmitted page limit (<= 200) distinct IDs.
    pub received: BTreeSet<String>,
    pub page_limit: usize,
    pub oldest: Option<u64>,
    pub retry_delay: u64,
}
pub(super) struct Publication {
    pub req: String,
    pub event: NostrEvent,
    pub auth_account: String, // Original sender; never infer a gift-wrap identity.
    pub deadline: u64,
    pub deliveries: BTreeMap<String, String>,
    pub sent: BTreeMap<String, u64>,
    // Ever attempted, independent of reconnect/retry markers; <= 20 planned routes.
    pub attempted: BTreeSet<String>,
    pub messages: BTreeMap<String, String>,
    pub observed: BTreeSet<String>,
    pub transport_confirmed: BTreeSet<String>,
    pub reported_success: bool,
    pub recipients: Vec<String>,
    pub inbox_routes: BTreeSet<String>,
    pub discovery_pending: bool,
}
#[derive(Default)]
pub struct Network {
    // At most 32 usable device signer public keys, never persisted.
    auth_signers: BTreeSet<String>,
    auth_active: Option<String>,
    // Job identities survive relay removal/re-admission; exhaustion refuses new AUTH.
    auth_next_job: u64,
    pub relays: BTreeMap<String, Relay>,
    observations: BTreeMap<String, quality::Observation>,
    pub quality_revision: u64,
    pub focused_sub: Option<String>,
    pub now: u64,
    pub relay_order: Vec<String>,
    // At most 24 configured routes awaiting a free slot; retried each tick.
    pub deferred_relays: BTreeSet<String>,
    pub known: BTreeMap<String, super::wire::RelayConfig>,
    pub(super) requests: BTreeMap<String, Request>,
    pub(super) effects: Vec<Effect>,
    pub(super) output: Vec<Output>,
    pub(super) publications: BTreeMap<String, Publication>,
    // Last 32 receipts plus results still displayed (<= 128 per client, 32 clients).
    receipts: BTreeMap<String, delivery::Receipt>,
    delivery_watches: BTreeSet<String>,
    // Last 32 plans (<= 2240 destinations each); no event bodies.
    publication_history: std::collections::VecDeque<publication_history::Record>,
    // At most 2048 authored events, <= 64 destinations each; persisted by Worker.
    pub(super) publication_routes: BTreeMap<String, Vec<String>>,
    // FIFO keys for the same 2048 route sets; persisted in this order.
    pub(super) publication_route_order: std::collections::VecDeque<String>,
    // Route URL payload is <= 4 MiB; encoded receipts remain below the 8 MiB boot cap.
    pub(super) publication_route_bytes: usize,
    pub publication_revision: u64,
    next: u64,
    pub(super) profiles_changed: bool,
    pub verifying: bool,
    pub(super) reported: BTreeMap<String, String>,
}
