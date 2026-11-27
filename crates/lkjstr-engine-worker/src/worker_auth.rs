//! At most four relay-auth signer jobs. Socket generations discard stale replies.
use super::*;
use lkjstr_core::engine::network::auth::AuthRequest;
use web_sys::AbortController;

#[derive(Clone)]
pub(super) struct Flight {
    client: u64,
    job: AuthRequest,
    abort: AbortController,
}
pub(super) type Jobs = BTreeMap<u64, Flight>; // up to four current relay AUTH wants

fn retire(h: &mut Host) {
    let now = h.time();
    let stale: Vec<_> = h
        .relay_auth_jobs
        .iter()
        .filter(|(_, flight)| {
            !h.sessions.contains_key(&flight.client)
                || !h.engine.network.auth_current(&flight.job, now)
        })
        .map(|(id, _)| *id)
        .collect();
    for id in stale {
        if let Some(flight) = h.relay_auth_jobs.remove(&id) {
            h.engine.network.auth_cancel(&flight.job);
            flight.abort.abort();
        }
    }
}
pub(super) fn stop(h: &mut Host) {
    for (_, flight) in std::mem::take(&mut h.relay_auth_jobs) {
        flight.abort.abort();
    }
}
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
    retire(h);
}
pub(super) fn pump_auth(host: &Rc<RefCell<Host>>) {
    retire(&mut host.borrow_mut());
    loop {
        let task = {
            let mut h = host.borrow_mut();
            if !h.loaded || h.stopped || h.relay_auth_jobs.len() >= 4 {
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
            let Ok(abort) = AbortController::new() else {
                return;
            };
            let Some(job) = h.engine.network.next_auth(&accounts, active.as_deref(), at) else {
                return;
            };
            let flight = Flight {
                client: id,
                job,
                abort,
            };
            h.relay_auth_jobs.insert(flight.job.token(), flight.clone());
            flight
        };
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let Flight { client, job, abort } = task;
            let result = uploads::signing::relay_auth(
                &host,
                client,
                lkjstr_core::engine::upload::Deadline::new(uploads::clock()),
                job.event.clone(),
                job.work,
                &abort.signal(),
            )
            .await;
            let mut h = host.borrow_mut();
            if h.relay_auth_jobs.remove(&job.token()).is_none() || h.stopped {
                return;
            }
            sync(&mut h);
            let at = h.time();
            let result = h.accounts.require_signer(&job.event.pubkey).and(result);
            h.engine.network.auth_signed(&job, result, at);
        });
    }
}
