//! Failed boot is a capability handshake followed by explicit request failures.
use super::*;
use lkjstr_core::engine::{
    account_storage,
    wire::{Input as I, Output as O, Session},
    zaps,
};
pub(super) fn failed(h: &Host) -> bool {
    matches!(h.account_store.state, account_storage::State::Unavailable)
}
pub(super) fn ready(h: &Host, id: u64, shared: bool) {
    // Drain the transport's pre-ready queue without claiming an empty account load.
    h.scope.direct(id, &Session::ready(shared));
}
pub(super) fn fail(h: &mut Host) {
    if h.stopped {
        return;
    }
    h.account_store.opening = None;
    h.account_store.state = account_storage::State::Unavailable;
    h.storage.database_failed = true;
    for id in h.sessions.keys().copied() {
        ready(h, id, matches!(h.scope, Sink::Shared { .. }));
    }
    for (id, message) in std::mem::take(&mut h.startup) {
        input(h, id, message);
    }
}
pub(super) fn input(h: &mut Host, id: u64, message: I) {
    let out = match message {
        I::Act { req, .. } => Some(Session::failure(req, "internal")),
        I::Open { sub, .. } => Some(O::State {
            sub,
            state: serde_json::json!({
                "phase":"failed", "relaysAsked":0, "relaysAnswered":0, "error":"internal"
            }),
        }),
        I::DmOpen { sub, query, .. } => Some(O::Dm {
            sub,
            snapshot: h
                .dm
                .inbox
                .snapshot(&query, "failed", Some("internal".into()), false),
        }),
        I::ZapQuote { req, query } => Some(O::ZapQuote {
            req,
            quote: zaps::Quote {
                target: query.target,
                phase: zaps::Phase::Failed,
                error: Some(zaps::Failure::Rejected),
                recipients: vec![],
            },
        }),
        I::ZapReceipts { req, query } => Some(O::ZapReceipts {
            req,
            page: zaps::ReceiptView {
                target: query.target,
                phase: zaps::Phase::Failed,
                error: Some(zaps::Failure::Rejected),
                coverage: zaps::Coverage::Failed,
                page: None,
            },
        }),
        I::Stats { req } => Some(O::Stats {
            req,
            stats: h.engine.stats(),
        }),
        I::RowAtTime { req, sub, .. } => Some(O::RowAtTime {
            req,
            sub,
            key: None,
            at: None,
            cached: false,
        }),
        I::Heartbeat => {
            if let Sink::Shared { clients, .. } = &mut h.scope {
                clients.heartbeat(id, now());
            }
            Some(O::Heartbeat)
        }
        I::Detach => {
            shared::detach(h, id);
            None
        }
        _ => None,
    };
    if let Some(out) = out {
        h.scope.direct(id, &out);
    }
}
