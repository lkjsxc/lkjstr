//! Relay pool: turns plans into REQ/CLOSE, tracks per-request state and feeds
//! relay heuristics. Connections open lazily and close when idle.

use std::collections::HashMap;

use lkjstr_core::plan::{PlanContext, Planned, plan};
use lkjstr_protocol::{ClientMessage, encode_client_message};

use super::Rt;
use crate::host::socket::Socket;
use crate::host::{after, now_ms};

/// Open requests per relay; more wait in a queue (relays enforce limits).
const MAX_SUBS_PER_RELAY: usize = 10;
/// A request with no answer by then counts as slow; the planner hedges.
const SLOW_MS: u64 = 4_000;

#[derive(Clone, Debug, PartialEq)]
pub enum SubState {
    Queued,
    Waiting,
    Live,
    Done,
    Failed(String),
}

pub struct Sub {
    pub sub_id: String,
    pub planned: Planned,
    pub state: SubState,
    pub sent_ms: u64,
    pub events: u32,
}

#[derive(Default)]
pub struct Conn {
    pub socket: Option<Socket>,
    pub open: bool,
    pub notice: Option<String>,
    pub error: Option<String>,
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
            .map(|(id, want)| (*id, want.clone()))
            .collect();
        let ctx = PlanContext {
            defaults: &self.defaults,
            directory: &self.store,
            scores: &self.scores,
            now_ms: now_ms(),
        };
        let planned: HashMap<String, Planned> = plan(&wants, &ctx)
            .into_iter()
            .map(|p| (p.key(), p))
            .collect();
        let stale: Vec<String> = self
            .net
            .subs
            .keys()
            .filter(|k| !planned.contains_key(*k))
            .cloned()
            .collect();
        for key in stale {
            if let Some(sub) = self.net.subs.remove(&key)
                && matches!(sub.state, SubState::Waiting | SubState::Live)
            {
                self.send(&sub.planned.relay, &ClientMessage::Close(sub.sub_id));
            }
        }
        for (key, item) in planned {
            match self.net.subs.get_mut(&key) {
                Some(sub) => sub.planned.wants = item.wants,
                None => {
                    self.net.next_sub += 1;
                    let sub = Sub {
                        sub_id: format!("q{}", self.net.next_sub),
                        planned: item,
                        state: SubState::Queued,
                        sent_ms: 0,
                        events: 0,
                    };
                    let relay = sub.planned.relay.clone();
                    self.net.subs.insert(key, sub);
                    self.pump(&relay);
                }
            }
        }
        let busy: Vec<String> = self
            .net
            .subs
            .values()
            .map(|s| s.planned.relay.clone())
            .collect();
        let now = now_ms();
        self.net
            .conns
            .retain(|url, conn| busy.contains(url) || conn.keep_until_ms > now);
    }

    /// Sends queued requests for `relay` while it has free slots.
    pub(super) fn pump(&mut self, relay: &str) {
        if !self.ensure_conn(relay) {
            return;
        }
        let active = |s: &&Sub| {
            s.planned.relay == relay && matches!(s.state, SubState::Waiting | SubState::Live)
        };
        let mut free =
            MAX_SUBS_PER_RELAY.saturating_sub(self.net.subs.values().filter(active).count());
        let mut keys: Vec<String> = self
            .net
            .subs
            .iter()
            .filter(|(_, s)| s.planned.relay == relay && s.state == SubState::Queued)
            .map(|(key, _)| key.clone())
            .collect();
        keys.sort();
        for key in keys {
            if free == 0 {
                break;
            }
            let Some(sub) = self.net.subs.get_mut(&key) else {
                continue;
            };
            let message = ClientMessage::Req {
                subscription_id: sub.sub_id.clone(),
                filters: sub.planned.filters.clone(),
            };
            sub.state = SubState::Waiting;
            sub.sent_ms = now_ms();
            free -= 1;
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
        let conn = self.net.conns.entry(relay.to_owned()).or_default();
        match socket {
            Ok(socket) => conn.socket = Some(socket),
            Err(error) => conn.error = Some(error),
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
