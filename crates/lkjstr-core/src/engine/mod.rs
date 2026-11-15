//! Pure engine. Explicit time and effect outputs make long-idle failures testable.
pub mod accounts;
pub mod bench;
mod channel_actions;
mod channel_create;
pub mod channels;
pub mod clients;
mod commands;
pub mod discovery;
pub mod feedback;
pub mod global;
mod history;
mod hydration;
mod identities;
mod input;
pub mod metrics;
pub mod network;
mod network_limits;
pub mod protocol;
pub mod query;
mod query_hidden;
mod query_predicates;
mod rich;
mod row_media;
mod row_model;
pub mod rows;
pub mod settings;
mod wants;
mod windows;
pub mod wire;
use crate::store::Store;
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent, VerificationResult, verify_event};
use network::Network;
use protocol::{Input, Output, Query};
use rows::Row;
use std::collections::{BTreeMap, VecDeque};
pub struct View {
    query: Query,
    anchor: Option<String>,
    before: usize,
    after: usize,
    rows: Vec<Row>,
    visible: bool,
    dirty: bool,
    // One current historical request per view; released with visibility/close.
    history: Option<lkjstr_protocol::NostrFilter>,
    notification_history: Option<lkjstr_protocol::NostrFilter>,
    at_bottom: bool,
    source_exhausted: bool,
}
struct Signing {
    event: UnsignedNostrEvent,
    deadline: u64,
}
pub struct Engine {
    pending_publications: usize,
    // At most 64 in-flight two-event creates; removed after both terminal outcomes.
    channel_creates: BTreeMap<String, channel_create::Creation>,
    pub client_tag: bool,
    pub discovery_paused: bool,
    pub discovery_account: Option<String>,
    pub discovery_relays: Vec<String>,
    pub servers: BTreeMap<String, (String, bool)>,
    pub private_lists: BTreeMap<String, Vec<Vec<String>>>,
    pub seen: BTreeMap<String, u64>,
    pub metrics: metrics::Metrics,
    pub store: Store,
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
            pending_publications: 0,
            channel_creates: BTreeMap::new(),
            client_tag: true,
            discovery_paused: false,
            discovery_account: None,
            discovery_relays: vec![],
            servers: BTreeMap::new(),
            private_lists: BTreeMap::new(),
            seen: BTreeMap::new(),
            metrics: Default::default(),
            store: Store::with_caps(16000, 4000),
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
    pub fn enqueue(&mut self, relay: String, event: NostrEvent) {
        if self.store.get(&event.id).is_some() || self.queue.iter().any(|(_, e)| *e == event) {
            if let Some(r) = self.network.relays.get_mut(&relay) {
                r.duplicates += 1;
            }
            return;
        }
        let bytes = crate::store::event_payload_bytes(&event);
        if self.queue.len() >= 4096 || self.queue_bytes.saturating_add(bytes) > 8 * 1024 * 1024 {
            self.dropped += 1;
            return;
        }
        self.queue_bytes += bytes;
        // Profiles requested for visible authors precede bulk note verification.
        if event.kind == 0 {
            self.queue.push_front((relay, event));
        } else {
            self.queue.push_back((relay, event));
        }
        self.network.verifying = true;
        self.metrics.verify_queue_peak = self.metrics.verify_queue_peak.max(self.queue.len());
    }
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
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
                    self.store.insert(nested, Some(&relay));
                }
                if relay != "cache" {
                    self.pending.push(e.clone(), true);
                }
                self.store.insert(e, Some(&relay));
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
        if self.network.publications.len() != self.pending_publications {
            self.pending_publications = self.network.publications.len();
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
    fn error(&mut self, req: Option<String>, code: &str) {
        self.outgoing.push(Output::Error {
            req,
            code: code.into(),
        });
    }
}
