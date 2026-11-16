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
#[path = "worker_dm_drafts.rs"]
mod drafts;
#[path = "worker_dm_editors.rs"]
pub(super) mod editors;
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
#[path = "worker_dm_signers.rs"]
mod signers;
#[path = "worker_dm_snapshot.rs"]
mod snapshot;
#[cfg(feature = "harness")]
#[path = "worker_dm_stop_probe.rs"]
pub(super) mod stop_probe;
pub(super) fn sync(h: &mut Host) {
    lifetime::sync(h);
    signers::sync(h);
    drafts::sync(h);
    editors::sync(h);
}
pub(super) fn input(h: &mut Host, id: u64, message: &I) -> bool {
    let handled = editors::input(h, id, message)
        || drafts::input(h, id, message)
        || input::input(h, id, message);
    signers::sync(h);
    handled
}
pub(super) fn output(h: &Rc<RefCell<Host>>, message: &Output) -> bool {
    delivery::output(h, message)
}
pub(super) struct View {
    query: dm::Query,
    visible: bool,
    last: Option<snapshot::Signature>,
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
    drafts: drafts::Book,
    editors: editors::Book,
    signers: signers::Book,
    authority: BTreeMap<String, u64>, // <=32 nonsecret signer replacement counters
    inbox: dm::Inbox,
    access: BTreeMap<String, (bool, u64)>, // <=32 accounts; each unlock has a distinct lease
    views: BTreeMap<(u64, String), View>,  // <=32 explicit private subscriptions
    hidden: BTreeSet<u64>,                 // <=32 attached clients
    cursors: BTreeMap<(String, String), u64>, // <=32 accounts x (8 inbox relays + legacy cursor)
    crypto: BTreeMap<(u64, String), (dm::signers::Lease, js_sys::Function)>, // <=8 crypto calls, removed at deadline
    queue: VecDeque<(String, String)>, // <=256 account/encrypted event IDs, never body copies
    attempted: BTreeSet<(String, String)>, // <=20000; pruned against bounded event store
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
                    && !self.errors.contains_key(&v.query.account)
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
        let mut pending: BTreeSet<_> = h.dm.pending.values().flatten().cloned().collect();
        let visible: Vec<_> =
            h.dm.views
                .iter()
                .filter(|((client, _), view)| {
                    view.visible
                        && !h.dm.hidden.contains(client)
                        && active.contains(&view.query.account)
                })
                .map(|(_, view)| view.query.clone())
                .collect();
        for query in &visible {
            if !query.unread_only {
                pending.extend(h.dm.inbox.participants(query));
            }
        }
        let mut wants = dm::routing::wants(&h.engine.store, &active, &pending, &h.dm.cursors);
        wants.extend(dm::routing::profile_wants(&h.dm.inbox, &visible));
        let now = h.time();
        h.engine.set_dm_wants(wants, now);
    }
    receive::pump(host);
    send::pump(host);
    drafts::pump(host);
    snapshot::emit(host);
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
        dm_draft: None,
        dm_draft_revision: None,
        dm_delivery: None,
        cancelled: None,
    }
}
