//! Revoke private list projections at the account transaction commit boundary.
use super::*;
use lkjstr_core::engine::accounts::Accounts;
pub(super) fn decreased(before: &Accounts, after: &Accounts) -> bool {
    before.entries.iter().any(|account| {
        before.require_signer(&account.pubkey).is_ok()
            && after.require_signer(&account.pubkey).is_err()
    })
}
pub(super) fn revoke(h: &mut Host, authority_decreased: bool) {
    let allowed = h
        .accounts
        .entries
        .iter()
        .filter(|a| h.accounts.require_signer(&a.pubkey).is_ok())
        .map(|a| a.pubkey.clone())
        .collect();
    let at = h.time();
    let Some(outputs) = h
        .engine
        .retain_private_accounts(&allowed, at, authority_decreased)
    else {
        return;
    };
    for (id, session) in &h.sessions {
        for output in session.borrow_mut().private_cache_changed(&h.engine) {
            h.scope.direct(*id, &output);
        }
    }
    for output in outputs {
        h.scope.post(&output, &h.engine, &h.sessions);
    }
}
