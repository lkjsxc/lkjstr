//! Private snapshots change only with private state, relevant metadata or relay evidence.
use super::*;
#[derive(PartialEq, Eq)]
pub(super) struct Signature {
    revision: u64,
    metadata: u64,
    phase: String,
    error: Option<String>,
    more: bool,
    failures: usize,
    blocked: Option<Vec<String>>,
}
pub(super) fn emit(host: &Rc<RefCell<Host>>) {
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
            let pending =
                h.dm.queue.iter().any(|(a, _)| a == account) || h.dm.signers.gate.reading(account);
            if phase == "live" && pending {
                "loading"
            } else {
                phase
            }
        };
        let more = h.engine.dm_history_more(account, &h.dm.cursors);
        let failures = h.dm.failures.get(account).copied().unwrap_or_default();
        let signature = Signature {
            revision: h.dm.inbox.revision,
            metadata: if query.unread_only {
                0
            } else {
                h.engine.dm_metadata_revision()
            },
            phase: phase.to_owned(),
            error: error.clone(),
            more,
            failures,
            blocked: h.engine.dm_blocked(&h.dm.inbox, &query),
        };
        if view.last.as_ref() == Some(&signature) {
            continue;
        }
        let mut snapshot = h.dm.inbox.snapshot(&query, phase, error, more);
        snapshot.undecryptable = failures;
        h.engine
            .decorate_dm_snapshot(&h.dm.inbox, &query, &mut snapshot);
        if let Some(view) = h.dm.views.get_mut(&(id, sub.clone())) {
            view.last = Some(signature);
        }
        h.scope.direct(id, &W::Dm { sub, snapshot });
    }
}
