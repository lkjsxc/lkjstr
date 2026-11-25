//! Pure engine. Explicit time and effect outputs make long-idle failures testable.
pub mod account_storage;
pub mod accounts;
mod acts;
pub mod bench;
pub mod bunker;
pub mod cache;
mod channel_actions;
mod channel_create;
mod channel_pending;
pub mod channels;
pub mod client_info;
mod client_tag;
pub mod clients;
mod commands;
pub mod discovery;
pub mod dm;
mod dm_network;
mod emoji;
pub mod feedback;
mod feedback_stats;
mod filter_identity;
pub mod global;
mod history;
mod hydration;
mod identities;
mod ingest;
mod input;
mod input_open;
mod list_events;
pub mod local_reads;
mod mention_people;
pub mod metrics;
mod nearby;
pub mod network;
mod network_limits;
mod note_routes;
mod outbox_discovery;
pub mod preview;
mod private_cache;
pub mod private_lists;
pub mod protocol;
pub mod public_reads;
mod publication_discovery;
pub mod publication_plan;
mod publication_routes;
pub mod query;
mod query_hidden;
mod query_predicates;
mod rich;
mod row_media;
mod row_model;
pub mod rows;
pub mod settings;
pub mod storage_inspection;
mod telemetry;
mod thread;
mod tick;
mod time_window;
mod time_window_relay;
pub use tick::TickPhase;
pub mod upload;
pub mod upload_jobs;
pub mod visibility;
mod wants;
pub mod weights;
mod windows;
pub mod wire;
mod zap_runtime;
mod zap_visible;
mod zap_wants;
pub mod zaps;
use crate::store::Store;
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent, VerificationResult, verify_event};
use network::Network;
use protocol::{Input, Output, Query};
use rows::Row;
use std::collections::{BTreeMap, VecDeque};
pub struct View {
    telemetry_id: u64,
    month_anchor: Option<u64>,
    fresh_count: usize,
    query: Query,
    anchor: Option<String>,
    time_window: Option<time_window::Pivot>,
    reading: Option<String>,
    head_through: Option<String>,
    before: usize,
    after: usize,
    rows: Vec<Row>,
    opened_after: u64,
    invalid_deliveries: u64,
    visible: bool,
    dirty: bool,
    history: Option<lkjstr_protocol::NostrFilter>, // One per view; released on hide/close.
    notification_history: Option<lkjstr_protocol::NostrFilter>,
    at_bottom: bool,
    source_exhausted: bool,
}
struct Signing {
    event: UnsignedNostrEvent,
    deadline: u64,
}
pub struct Engine {
    local_reads: local_reads::State,
    dm_wants: Vec<dm::routing::Want>,
    pub previews: preview::Previews,
    pub zaps: zaps::State,
    zap_demand: zap_visible::Demand,
    pending_publications: usize,
    note_routes: note_routes::NoteRoutes,
    // Signed local notes before their first frame, at most the 64 publication jobs.
    tentative_notes: std::collections::BTreeSet<String>,
    // At most 64 creates (both outcomes) and 64 pending owner-list lookups (20s).
    channel_creates: BTreeMap<String, channel_create::Creation>,
    channel_pending: BTreeMap<String, channel_pending::Pending>,
    pub client_tag: bool,
    // One override per registered device account, at most 32.
    pub client_tag_accounts: BTreeMap<String, bool>,
    client_info: client_info::Lookups,
    pub discovery_paused: bool,
    pub discovery_accounts: Vec<String>,
    pub discovery_relays: Vec<String>,
    pub servers: BTreeMap<String, feedback::ServerVerdict>,
    server_revision: u64,
    pub private_lists: BTreeMap<String, Vec<Vec<String>>>,
    pub private_reads: private_lists::Reads,
    pub seen: BTreeMap<String, u64>,
    pub notification_ties: BTreeMap<String, std::collections::BTreeSet<String>>,
    pub notification_zaps: BTreeMap<String, zaps::ReadState>,
    pub metrics: metrics::Metrics,
    pub store: Store,
    pub read_contexts: cache::ReadContexts,
    /// False when persisted history extends beyond the hydrated store: no partial time rail.
    pub cached_history_complete: bool,
    /// The page's local days for the time rail; UTC until the Worker sets the browser's own.
    pub calendar: Box<dyn crate::calendar::Calendar>,
    pub signed_out_global_filter: bool,
    pub pending: crate::persistence::PendingEvents,
    pub network: Network,
    views: BTreeMap<String, View>,
    next_telemetry_view: u64,
    signing: BTreeMap<String, Signing>,
    outgoing: Vec<Output>,
    queue: VecDeque<ingest::QueuedEvent>,
    queue_bytes: usize,
    last_flush: u64,
    pub verified: u64,
    pub rejected: u64,
    pub dropped: u64,
    delivery_sequence: u64,
}
impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}
impl Engine {
    pub fn new() -> Self {
        Self {
            local_reads: Default::default(),
            previews: Default::default(),
            zaps: Default::default(),
            zap_demand: Default::default(),
            dm_wants: vec![],
            pending_publications: 0,
            note_routes: note_routes::NoteRoutes::default(),
            tentative_notes: std::collections::BTreeSet::new(),
            channel_creates: BTreeMap::new(),
            channel_pending: BTreeMap::new(),
            client_tag: true,
            client_tag_accounts: BTreeMap::new(),
            client_info: Default::default(),
            discovery_paused: false,
            discovery_accounts: vec![],
            discovery_relays: vec![],
            servers: BTreeMap::new(),
            server_revision: 0,
            private_lists: BTreeMap::new(),
            private_reads: Default::default(),
            seen: BTreeMap::new(),
            notification_ties: BTreeMap::new(),
            notification_zaps: BTreeMap::new(),
            metrics: Default::default(),
            store: Store::with_caps(16000, 4000),
            read_contexts: Default::default(),
            cached_history_complete: true,
            signed_out_global_filter: true,
            pending: Default::default(),
            network: Network::default(),
            views: BTreeMap::new(),
            next_telemetry_view: 0,
            signing: BTreeMap::new(),
            outgoing: vec![],
            queue: VecDeque::new(),
            queue_bytes: 0,
            last_flush: 0,
            verified: 0,
            rejected: 0,
            dropped: 0,
            delivery_sequence: 0,
            calendar: Box::new(crate::calendar::Utc),
        }
    }
    pub fn drain(&mut self) -> Vec<Output> {
        let mut result = std::mem::take(&mut self.outgoing);
        result.extend(self.network.drain_output());
        let mut removed = false;
        for output in &result {
            if let Output::Result {
                id: Some(id),
                error,
                ..
            } = output
                && self.tentative_notes.remove(id)
                && error
                    .as_deref()
                    .is_some_and(|code| matches!(code, "no-relays" | "relay-unreachable"))
            {
                removed |= self.store.discard_unseen_note(id);
            }
        }
        if removed {
            self.invalidate();
        }
        self.channel_outputs(result)
    }
}

#[cfg(test)]
mod kind_effects_test;
