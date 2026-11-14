//! Pure engine. Explicit time and effect outputs make long-idle failures testable.
pub mod bench;
pub mod clients;
mod commands;
mod identities;
pub mod metrics;
pub mod network;
mod network_limits;
pub mod protocol;
pub mod query;
mod query_predicates;
mod row_media;
mod row_model;
pub mod rows;
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
}
struct Signing {
    event: UnsignedNostrEvent,
    deadline: u64,
}
pub struct Engine {
    pub metrics: metrics::Metrics,
    pub store: Store,
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
            metrics: Default::default(),
            store: Store::with_caps(16000, 4000),
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
    pub fn input(&mut self, input: Input, now: u64) {
        match input {
            Input::Open { sub, query } => {
                if self.views.len() >= 128 && !self.views.contains_key(&sub) {
                    self.error(Some(sub), "subscription-limit");
                    return;
                }
                self.views.insert(
                    sub.clone(),
                    View {
                        query,
                        anchor: None,
                        before: 0,
                        after: 50,
                        rows: vec![],
                        visible: true,
                        dirty: true,
                    },
                );
                self.render(&sub, true);
                self.replan(now);
            }
            Input::Close { sub } => {
                self.views.remove(&sub);
                self.replan(now);
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
            } => {
                if let Some(v) = self.views.get_mut(&sub) {
                    v.anchor = anchor;
                    v.before = before.min(100);
                    v.after = after.min(200);
                    self.render(&sub, true);
                }
            }
            Input::Configure { relays } => {
                self.network.configure(relays, now);
                self.replan(now);
            }
            Input::Hint {
                visible_subs,
                page_hidden,
                ..
            } => {
                for (id, v) in &mut self.views {
                    v.visible = !page_hidden && visible_subs.contains(id);
                }
                self.replan(now);
            }
            Input::Action {
                req,
                account,
                action,
            } => self.action(req, account, action, now),
            Input::Signed { req, event, .. } => self.signed(req, event, now),
        }
    }
    pub fn enqueue(&mut self, relay: String, event: NostrEvent) {
        if self.store.get(&event.id).is_some() || self.queue.iter().any(|(_, e)| *e == event) {
            return;
        }
        let bytes = crate::store::event_payload_bytes(&event);
        if self.queue.len() >= 4096 || self.queue_bytes.saturating_add(bytes) > 8 * 1024 * 1024 {
            self.dropped += 1;
            return;
        }
        self.queue_bytes += bytes;
        self.queue.push_back((relay, event));
        self.network.verifying = true;
        self.metrics.verify_queue_peak = self.metrics.verify_queue_peak.max(self.queue.len());
    }
    /// Called away from socket callbacks. At most 32 verifications per slice.
    pub fn tick(&mut self, now: u64) {
        let revision = self.store.revision();
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
        if self.store.revision() != revision {
            self.replan(now);
        }
        self.network.tick(now);
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
        result
    }
    fn error(&mut self, req: Option<String>, code: &str) {
        self.outgoing.push(Output::Error {
            req,
            code: code.into(),
        });
    }
}
