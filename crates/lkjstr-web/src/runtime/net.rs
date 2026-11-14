//! Relay pool: turns plans into REQ/CLOSE, tracks per-request state and feeds
//! relay heuristics. Connections open lazily and close when idle.

use std::collections::HashMap;

use lkjstr_core::plan::{PlanContext, plan};
use lkjstr_core::requests::{self, Auth};
pub use lkjstr_core::requests::{Sub, SubState};
use lkjstr_protocol::{ClientMessage, encode_client_message};

use super::Rt;
use crate::host::socket::Socket;
use crate::host::{after, now_ms};

/// Open requests per relay; more wait in a queue (relays enforce limits).
const MAX_SUBS_PER_RELAY: usize = 10;
/// A request with no answer by then counts as slow; the planner hedges.
const SLOW_MS: u64 = 4_000;

#[derive(Default)]
pub struct Conn {
    pub socket: Option<Socket>,
    pub open: bool,
    pub notice: Option<String>,
    pub error: Option<String>,
    pub(super) auth: Auth,
    pub(super) auth_until_ms: u64,
    /// Messages waiting for the socket to open (bounded by `MAX_OUTBOX`).
    pub(super) outbox: Vec<String>,
    /// Publishing keeps an otherwise idle connection until then.
    keep_until_ms: u64,
}

const MAX_OUTBOX: usize = 50;
const PUBLISH_KEEP_MS: u64 = 15_000;

#[derive(Default)]
pub struct Net {
    pub conns: HashMap<String, Conn>,
    /// Keyed by `Planned::key`; bounded by the current plan.
    pub subs: HashMap<String, Sub>,
    next_sub: u32,
}

impl Rt {
    pub(super) fn replan(&mut self) {
        let wants: Vec<_> = self
            .wants
            .iter()
            .filter(|(id, _)| !self.expired.contains_key(id))
            .map(|(id, want)| (*id, want.clone()))
            .collect();
        let ctx = PlanContext {
            defaults: &self.defaults,
            directory: &self.store,
            scores: &self.scores,
            now_ms: now_ms(),
        };
        let close = requests::reconcile(
            &mut self.net.subs,
            plan(&wants, &ctx),
            &mut self.net.next_sub,
        );
        for (relay, sub_id) in close {
            self.send(&relay, &ClientMessage::Close(sub_id));
        }
        let relays: std::collections::HashSet<_> = self
            .net
            .subs
            .values()
            .filter(|s| s.state.busy())
            .map(|s| s.planned.relay.clone())
            .collect();
        for relay in relays {
            self.pump(&relay);
        }
        let now = now_ms();
        self.net.conns.retain(|url, conn| {
            requests::busy(&self.net.subs, url)
                || conn.keep_until_ms > now
                || (conn.auth.pending.is_some() && conn.auth_until_ms > now)
        });
    }

    /// Sends queued requests for `relay` while it has free slots.
    pub(super) fn pump(&mut self, relay: &str) {
        let keys = requests::ready(&self.net.subs, relay, MAX_SUBS_PER_RELAY);
        if keys.is_empty() || !self.ensure_conn(relay) {
            return;
        }
        for key in keys {
            let Some(sub) = self.net.subs.get_mut(&key) else {
                continue;
            };
            let message = ClientMessage::Req {
                subscription_id: sub.sub_id.clone(),
                filters: sub.planned.filters.clone(),
            };
            sub.state = SubState::Waiting;
            sub.sent_ms = now_ms();
            self.scores.entry(relay).reqs += 1;
            self.send(relay, &message);
            self.watch_slow(key);
        }
    }

    fn watch_slow(&self, key: String) {
        let Some(app) = self.app() else { return };
        after(SLOW_MS, move || {
            let slow = app.update(|rt| {
                let sub = rt.net.subs.get(&key)?;
                (sub.state == SubState::Waiting).then(|| sub.planned.relay.clone())
            });
            if let Some(relay) = slow {
                app.update(|rt| {
                    rt.scores.entry(&relay).on_timeout(SLOW_MS as f64);
                    rt.schedule_replan(10);
                });
            }
        });
    }

    /// Returns whether the relay is open (queue is flushed on open).
    fn ensure_conn(&mut self, relay: &str) -> bool {
        if let Some(conn) = self.net.conns.get(relay)
            && conn.socket.is_some()
        {
            return conn.open;
        }
        let Some(app) = self.app() else { return false };
        let url = relay.to_owned();
        let socket = Socket::connect(relay, move |event| app.on_socket(&url, event));
        match socket {
            Ok(socket) => self.net.conns.entry(relay.to_owned()).or_default().socket = Some(socket),
            Err(error) => self.on_socket(relay, crate::host::socket::SocketEvent::Closed(error)),
        }
        false
    }

    pub(super) fn send(&mut self, relay: &str, message: &ClientMessage) {
        let Ok(text) = encode_client_message(message) else {
            return;
        };
        self.send_raw(relay, &text);
    }

    /// Sends now, or once the connection opens (publishing).
    pub(super) fn send_when_open(&mut self, relay: &str, text: String) {
        let open = self.ensure_conn(relay);
        if open {
            self.send_raw(relay, &text);
        }
        if let Some(app) = self.app() {
            after(PUBLISH_KEEP_MS + 1, move || {
                app.update(|rt| rt.schedule_replan(1))
            });
        }
        if let Some(conn) = self.net.conns.get_mut(relay) {
            conn.keep_until_ms = now_ms() + PUBLISH_KEEP_MS;
            if !open && conn.outbox.len() < MAX_OUTBOX {
                conn.outbox.push(text);
            }
        }
    }

    pub(super) fn send_raw(&mut self, relay: &str, text: &str) {
        if let Some(socket) = self.net.conns.get(relay).and_then(|c| c.socket.as_ref()) {
            socket.send(text);
        }
    }
}
