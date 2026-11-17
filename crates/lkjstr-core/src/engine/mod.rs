//! Pure engine. Explicit time and effect outputs make long-idle failures testable.
pub mod account_storage;
pub mod accounts;
pub mod bench;
pub mod bunker;
pub mod cache;
mod channel_actions;
mod channel_create;
mod channel_pending;
pub mod channels;
pub mod clients;
mod commands;
pub mod discovery;
pub mod dm;
mod dm_network;
mod emoji;
pub mod feedback;
mod filter_identity;
pub mod global;
mod history;
mod hydration;
mod identities;
mod ingest;
mod input;
mod input_open;
mod list_events;
pub mod metrics;
pub mod network;
mod network_limits;
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
mod thread;
pub mod upload;
pub mod upload_jobs;
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
    query: Query,
    anchor: Option<String>,
    reading: Option<String>,
    before: usize,
    after: usize,
    rows: Vec<Row>,
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
    dm_wants: Vec<dm::routing::Want>,
    pub previews: preview::Previews,
    pub zaps: zaps::State,
    zap_demand: zap_visible::Demand,
    pending_publications: usize,
    // At most 64 creates (both outcomes) and 64 pending owner-list lookups (20s).
    channel_creates: BTreeMap<String, channel_create::Creation>,
    channel_pending: BTreeMap<String, channel_pending::Pending>,
    pub client_tag: bool,
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
    pub signed_out_global_filter: bool,
    pub pending: crate::persistence::PendingEvents,
    pub network: Network,
    views: BTreeMap<String, View>,
    signing: BTreeMap<String, Signing>,
    outgoing: Vec<Output>,
    queue: VecDeque<(String, NostrEvent)>,
    queue_bytes: usize,
    last_flush: u64,
    pub verified: u64,
    pub rejected: u64,
    pub dropped: u64,
}
impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}
impl Engine {
    pub fn new() -> Self {
        Self {
            previews: Default::default(),
            zaps: Default::default(),
            zap_demand: Default::default(),
            dm_wants: vec![],
            pending_publications: 0,
            channel_creates: BTreeMap::new(),
            channel_pending: BTreeMap::new(),
            client_tag: true,
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
            signing: BTreeMap::new(),
            outgoing: vec![],
            queue: VecDeque::new(),
            queue_bytes: 0,
            last_flush: 0,
            verified: 0,
            rejected: 0,
            dropped: 0,
        }
    }
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
        self.previews.tick(now);
        let revision = self.store.revision();
        let was_verifying = self.network.verifying;
        for _ in 0..32 {
            let Some((relay, e)) = self.queue.pop_front() else {
                break;
            };
            self.queue_bytes = self
                .queue_bytes
                .saturating_sub(crate::store::event_payload_bytes(&e));
            if self.store.get(&e.id).is_some() {
                continue;
            }
            if matches!(verify_event(&e), VerificationResult::Ok(_)) {
                self.verified += 1;
                self.network.event(&relay, &e, now);
                if let Some(nested) = lkjstr_protocol::verified_nested_repost(&e) {
                    self.insert_verified(nested, Some(&relay));
                }
                if relay != "cache" {
                    self.pending.push(e.clone(), true);
                }
                self.insert_verified(e, Some(&relay));
                for v in self.views.values_mut() {
                    v.dirty = true;
                }
            } else {
                self.rejected += 1;
            }
        }
        self.network.verifying = !self.queue.is_empty();
        self.network.profiles_changed |= was_verifying && !self.network.verifying;
        if self.store.revision() != revision {
            self.replan(now);
        }
        self.network.tick(now);
        self.resume_channel_actions(now);
        if self.network.publications.len() != self.pending_publications {
            self.pending_publications = self.network.publications.len();
            self.replan(now);
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
        if std::mem::take(&mut self.network.profiles_changed) {
            self.replan(now);
            for v in self.views.values_mut() {
                v.dirty = true;
            }
        }
        self.refill_history(now);
        self.zap_tick(now);
        for v in self.views.values_mut() {
            if v.source_exhausted != history::exhausted(&self.network, &self.store, v) {
                v.dirty = true;
            }
        }
        let expired: Vec<_> = self
            .signing
            .iter()
            .filter(|(_, s)| now >= s.deadline)
            .map(|(k, _)| k.clone())
            .collect();
        for req in expired {
            self.signing.remove(&req);
            self.error(Some(req), "signer-timeout");
        }
        if now.saturating_sub(self.last_flush) >= 75 {
            self.last_flush = now;
            let subs: Vec<_> = self
                .views
                .iter()
                .filter(|(_, v)| v.visible && v.dirty)
                .map(|(id, _)| id.clone())
                .collect();
            for sub in subs {
                self.render(&sub, false);
            }
        }
    }
    pub fn drain(&mut self) -> Vec<Output> {
        let mut result = std::mem::take(&mut self.outgoing);
        result.extend(self.network.drain_output());
        self.channel_outputs(result)
    }
}
