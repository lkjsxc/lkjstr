//! At most four relay-auth signer jobs. Socket generations discard stale replies.
use super::*;
pub(super) fn sync(h: &mut Host) {
    let accounts = h
        .accounts
        .entries
        .iter()
        .filter(|a| h.accounts.require_signer(&a.pubkey).is_ok())
        .map(|a| a.pubkey.clone())
        .collect::<Vec<_>>();
    let active = h.accounts.active.clone();
    let at = h.time();
    h.engine
        .network
        .set_auth_accounts(&accounts, active.as_deref(), at);
}
pub(super) fn pump_auth(host: &Rc<RefCell<Host>>) {
    loop {
        let task = {
            let mut h = host.borrow_mut();
            if !h.loaded || h.stopped || h.relay_auth_inflight >= 4 {
                return;
            }
            let Some(id) = h.sessions.keys().next().copied() else {
                return;
            };
            let mut accounts = h
                .accounts
                .entries
                .iter()
                .filter(|a| h.accounts.require_signer(&a.pubkey).is_ok())
                .map(|a| a.pubkey.clone())
                .collect::<Vec<_>>();
            if let Some(active) = &h.accounts.active {
                accounts.sort_by_key(|a| a != active);
            }
            let at = h.time();
            let active = h.accounts.active.clone();
            let Some(job) = h.engine.network.next_auth(&accounts, active.as_deref(), at) else {
                return;
            };
            h.relay_auth_inflight += 1;
            (id, job)
        };
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let (id, job) = task;
            let result = uploads::signing::sign(
                &host,
                id,
                lkjstr_core::engine::upload::Deadline::new(uploads::clock()),
                job.event.clone(),
            )
            .await;
            let mut h = host.borrow_mut();
            h.relay_auth_inflight = h.relay_auth_inflight.saturating_sub(1);
            if h.stopped {
                return;
            }
            sync(&mut h);
            let at = h.time();
            let result = h.accounts.require_signer(&job.event.pubkey).and(result);
            h.engine.network.auth_signed(&job, result, at);
        });
    }
}
