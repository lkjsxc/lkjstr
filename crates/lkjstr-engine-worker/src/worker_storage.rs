//! Owner-scoped finite storage inspection. No mutation or private-store reads.
use super::*;
use crate::browser::storage_inspection as browser;
use lkjstr_core::engine::{storage_inspection as policy, wire::{Input as W, Output as O, Session}};
#[path = "worker_storage_effects.rs"]
mod jobs;
#[derive(Default)]
pub(super) struct State {
    book: policy::Book,
    counts: BTreeMap<u64, (policy::Lease, web_sys::AbortController)>,
    // StorageManager has no abort API. Keep at most one unresolved browser call,
    // even after its request expires; a later request never adopts its response.
    estimating: bool,
    detached: std::collections::BTreeSet<u64>, // attached-or-not-yet-booted clients, at most 32
    pub(super) database_failed: bool,
    pub(super) replaying_startup: bool,
}
pub(super) fn input(h: &mut Host, client: u64, input: &W) -> bool {
    let storage = matches!(input, W::StorageInspect { .. } | W::StorageClose { .. });
    if !h.sessions.contains_key(&client) || h.storage.detached.contains(&client) { return storage; }
    if h.storage.replaying_startup && matches!(input, W::Hint { .. } | W::Detach) { return false; }
    match input {
        W::StorageInspect { req } => {
            let Some(at) = browser::now() else {
                h.scope.direct(client, &Session::failure(req.clone(), "unsupported"));
                return true;
            };
            let memory = policy::Memory {
                events: h.engine.store.len() as u64,
                event_payload_bytes: h.engine.store.payload_bytes() as u64,
                at,
            };
            if let Err(code) = h.storage.book.begin(client, req, memory) {
                h.scope.direct(client, &Session::failure(req.clone(), code));
            }
        }
        W::StorageClose { req } => { h.storage.book.close(client, req); prune(h); }
        W::Hint { hint } => { h.storage.book.visible(client, !hint.page_hidden); prune(h); }
        W::Detach => detach(h, client),
        _ => {}
    }
    storage
}
fn deliver(h: &Host, reply: Option<policy::Reply>) {
    if !h.stopped && let Some(reply) = reply && h.sessions.contains_key(&reply.lease.client) {
        h.scope.direct(reply.lease.client, &O::Storage { req: reply.lease.req, report: reply.report });
    }
}
fn prune(h: &mut Host) {
    let State { book, counts, .. } = &mut h.storage;
    counts.retain(|_, (lease, abort)| {
        if book.current(lease) { true } else { abort.abort(); false }
    });
}
pub(super) fn detach(h: &mut Host, client: u64) {
    let attached = &h.sessions;
    h.storage.detached.retain(|id| attached.contains_key(id));
    if h.sessions.contains_key(&client) && h.storage.detached.len() < 32 { h.storage.detached.insert(client); }
    h.storage.book.detach(client);
    prune(h);
}
pub(super) fn stop(h: &mut Host) {
    h.storage.book.clear();
    prune(h);
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    {
        let mut h = host.borrow_mut();
        if h.stopped { return; }
        let Host { sessions, storage, .. } = &mut *h;
        storage.detached.retain(|client| sessions.contains_key(client));
        if storage.book.is_empty() && storage.counts.is_empty() { return; }
    }
    let Some(at) = browser::now() else {
        let mut h = host.borrow_mut();
        for lease in h.storage.book.leases() {
            h.scope.direct(lease.client, &Session::failure(lease.req, "unsupported"));
        }
        stop(&mut h);
        return;
    };
    let (counts, origin) = {
        let mut h = host.borrow_mut();
        if h.stopped { return; }
        for reply in h.storage.book.expire(at) { deliver(&h, Some(reply)); }
        prune(&mut h);
        let counts = if let Some(db) = h.db.clone() {
            h.storage.book.count_work().into_iter().map(|lease| (lease, db.clone())).collect()
        } else {
            let failure = match browser::database_supported() {
                Some(false) => Some(policy::Count::Unsupported),
                None => Some(policy::Count::Failed),
                Some(true) if h.storage.database_failed => Some(policy::Count::Failed),
                Some(true) => None,
            };
            if let Some(failure) = failure {
                for lease in h.storage.book.count_work() {
                    let reply = h.storage.book.count(&lease, failure.clone(), at);
                    deliver(&h, reply);
                }
            }
            Vec::new()
        };
        let origin = if h.storage.estimating { Vec::new() } else { h.storage.book.origin_work() };
        if !origin.is_empty() { h.storage.estimating = true; }
        (counts, origin)
    };
    for (lease, db) in counts { jobs::count(host, lease, db); }
    if !origin.is_empty() { jobs::origin(host, origin); }
}
