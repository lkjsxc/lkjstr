//! DM orchestration. Only signed encrypted events enter the shared event store.
use super::*;
use lkjstr_core::engine::{
    dm,
    wire::{Input as I, Output as W, Session},
};
use std::collections::{BTreeSet, VecDeque};
#[path = "worker_dm_crypto.rs"]
mod crypto;
#[path = "worker_dm_delivery.rs"]
mod delivery;
#[path = "worker_dm_input.rs"]
mod input;
#[path = "worker_dm_lifetime.rs"]
mod lifetime;
#[path = "worker_dm_marks.rs"]
mod marks;
#[path = "worker_dm_receive.rs"]
mod receive;
#[path = "worker_dm_send.rs"]
mod send;
pub(super) fn sync(h: &mut Host) {
    lifetime::sync(h);
}
pub(super) fn input(h: &mut Host, id: u64, message: &I) -> bool {
    input::input(h, id, message)
}
pub(super) fn output(h: &Rc<RefCell<Host>>, message: &Output) -> bool {
    delivery::output(h, message)
}
pub(super) struct View {
    query: dm::Query,
    visible: bool,
    last: Option<(u64, String, Option<String>, bool, usize)>,
}
pub(super) enum Task {
    Send {
        client: u64,
        req: String,
        account: String,
        draft: dm::Draft,
    },
    Relays {
        client: u64,
        req: String,
        account: String,
        relays: Vec<String>,
    },
    Seen {
        client: u64,
        req: String,
        account: String,
        conversation: String,
    },
}
#[derive(Default)]
pub(super) struct State {
    inbox: dm::Inbox,
    access: BTreeMap<String, (bool, u64)>, // <=32 accounts; each unlock has a distinct lease
    views: BTreeMap<(u64, String), View>,  // <=32 explicit private subscriptions
    hidden: BTreeSet<u64>,                 // <=32 attached clients
    cursors: BTreeMap<(String, String), u64>, // <=32 accounts x (8 inbox relays + legacy cursor)
    crypto: BTreeMap<(u64, String), (String, js_sys::Function)>, // <=8 crypto calls, removed at deadline
    queue: VecDeque<(String, String)>, // <=256 account/encrypted event IDs, never body copies
    attempted: BTreeSet<(String, String)>, // <=20000; pruned against bounded event store
    decrypting: BTreeMap<String, usize>, // <=2 active account counters
    receiving: usize,                  // <=2, one signer prompt per encrypted layer
    tasks: Vec<(Task, u64)>,           // <=4 combined queued/running writes
    running: usize,
    pending: BTreeMap<(u64, String), BTreeSet<String>>, // <=4 x 32 route discoveries
    sending: BTreeMap<String, delivery::Sending>,       // <=4 jobs x 32 encrypted wrappers
    errors: BTreeMap<String, String>,                   // <=32 opened accounts
    failures: BTreeMap<String, usize>,                  // undecryptable envelopes, never fake empty
    serial: u64,
    last_scan: u64,
    next_emit: u64,
    marks_error: Option<&'static str>,
    marks_started: bool,
    marks_ready: bool,
    marks_busy: bool,
}
impl State {
    fn active(&self) -> BTreeSet<String> {
        self.views
            .iter()
            .filter(|((id, _), v)| {
                v.visible
                    && !self.hidden.contains(id)
                    && self.access.get(&v.query.account).is_some_and(|(ok, _)| *ok)
            })
            .map(|(_, v)| v.query.account.clone())
            .collect()
    }
    fn client(&self, account: &str) -> Option<u64> {
        self.views
            .iter()
            .find(|((id, _), v)| {
                v.query.account == account && v.visible && !self.hidden.contains(id)
            })
            .map(|((id, _), _)| *id)
    }
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    if !host.borrow().loaded || host.borrow().stopped {
        return;
    }
    sync(&mut host.borrow_mut());
    marks::load(host);
    {
        let mut h = host.borrow_mut();
        let saved: BTreeSet<_> = h
            .accounts
            .entries
            .iter()
            .map(|a| a.pubkey.clone())
            .collect();
        let clients: BTreeSet<_> = h.sessions.keys().copied().collect();
        h.dm.views
            .retain(|(id, _), v| clients.contains(id) && saved.contains(&v.query.account));
        h.dm.hidden.retain(|id| clients.contains(id));
        let unlocked: BTreeSet<_> = saved
            .iter()
            .filter(|a| h.accounts.require_signer(a).is_ok())
            .cloned()
            .collect();
        h.dm.inbox.retain_accounts(&saved);
        h.dm.inbox.retain_messages(&unlocked);
        h.dm.queue.retain(|(a, _)| unlocked.contains(a));
        h.dm.attempted.retain(|(a, _)| unlocked.contains(a));
        let active = h.dm.active();
        h.dm.cursors.retain(|(a, _), _| active.contains(a));
        h.dm.errors.retain(|a, _| saved.contains(a));
        h.dm.failures.retain(|a, _| saved.contains(a));
        let pending = h.dm.pending.values().flatten().cloned().collect();
        let wants = dm::routing::wants(&h.engine.store, &active, &pending, &h.dm.cursors);
        let now = h.time();
        h.engine.set_dm_wants(wants, now);
    }
    receive::pump(host);
    send::pump(host);
    emit(host);
}
fn emit(host: &Rc<RefCell<Host>>) {
    let mut h = host.borrow_mut();
    let now = h.time();
    if now < h.dm.next_emit {
        return;
    }
    h.dm.next_emit = now + 250;
    let keys: Vec<_> = h.dm.views.keys().cloned().collect();
    for (id, sub) in keys {
        let Some(view) = h.dm.views.get(&(id, sub.clone())) else {
            continue;
        };
        if !view.visible || h.dm.hidden.contains(&id) {
            continue;
        }
        let query = view.query.clone();
        let account = &query.account;
        let mut error = h
            .accounts
            .require_signer(account)
            .err()
            .map(str::to_owned)
            .or_else(|| h.dm.marks_error.map(str::to_owned))
            .or_else(|| h.dm.errors.get(account).cloned());
        let phase = if h.dm.marks_error.is_some() {
            "failed"
        } else if !h.dm.marks_ready {
            "loading"
        } else if error.is_some() {
            if error.as_deref() == Some("unsupported") {
                "unsupported"
            } else {
                "failed"
            }
        } else {
            let (phase, code) = h.engine.dm_phase(account);
            error = code.map(str::to_owned);
            let pending = h.dm.queue.iter().any(|(a, _)| a == account)
                || h.dm.decrypting.get(account).is_some_and(|n| *n > 0);
            if phase == "live" && pending {
                "loading"
            } else {
                phase
            }
        };
        let more = h.engine.dm_history_more(account, &h.dm.cursors);
        let failures = h.dm.failures.get(account).copied().unwrap_or_default();
        let signature = (
            h.dm.inbox.revision,
            phase.to_owned(),
            error.clone(),
            more,
            failures,
        );
        if view.last.as_ref() == Some(&signature) {
            continue;
        }
        let mut snapshot = h.dm.inbox.snapshot(&query, phase, error, more);
        snapshot.undecryptable = failures;
        if let Some(view) = h.dm.views.get_mut(&(id, sub.clone())) {
            view.last = Some(signature);
        }
        h.scope.direct(id, &W::Dm { sub, snapshot });
    }
}
fn result(req: String, error: Option<&str>, id: Option<String>) -> W {
    W::Result {
        req,
        ok: error.is_none(),
        error: error.map(|code| lkjstr_core::engine::wire::Failure {
            code: code.into(),
            message: None,
        }),
        id,
        delivery: None,
        uploaded: None,
        key: None,
        encrypted_key: None,
    }
}
