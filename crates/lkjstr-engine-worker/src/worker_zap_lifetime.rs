use super::*;
use lkjstr_core::engine::wire::actions::Action as A;
pub(in crate::worker) enum Change {
    None,
    ActiveAfterCommit,
    Account(String),
}
pub(in crate::worker) fn account_change(action: &A) -> Change {
    match action {
        A::AccountAdd { .. } | A::AccountImportEncrypted { .. } => Change::ActiveAfterCommit,
        A::AccountUnlock { pubkey, .. }
        | A::AccountLock { pubkey }
        | A::AccountRemove { pubkey } => Change::Account(pubkey.clone()),
        _ => Change::None,
    }
}
pub(in crate::worker) fn committed(h: &mut Host, change: Change) {
    let account = match change {
        Change::None => None,
        Change::ActiveAfterCommit => h.accounts.active.clone(),
        Change::Account(account) => Some(account),
    };
    if let Some(account) = account {
        h.engine.zaps.jobs.account_changed(&account);
        cancel_finished(h);
    }
}
pub(in crate::worker) fn detach(h: &mut Host, client: u64) {
    h.engine.zaps.jobs.detach(client);
    cancel_finished(h);
}
fn cancel_finished(h: &mut Host) {
    // Draining jobs alone preserves pending provider effects for the regular pump.
    for token in h.engine.zaps.cancelled_invoices() {
        if let Some(controller) = h.zaps.invoices.remove(&token) {
            controller.abort();
        }
    }
}
pub(in crate::worker) fn stop(h: &mut Host) {
    for (_, controller) in std::mem::take(&mut h.zaps.providers) {
        controller.abort();
    }
    for (_, controller) in std::mem::take(&mut h.zaps.invoices) {
        controller.abort();
    }
    let clients: Vec<_> = h.sessions.keys().copied().collect();
    for client in clients {
        h.engine.zaps.jobs.detach(client);
    }
}
