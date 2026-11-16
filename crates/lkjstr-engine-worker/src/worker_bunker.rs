//! Ephemeral, exact-client remote authorization. URLs leave only through an owned port.
use super::*;
use lkjstr_core::engine::{
    bunker as policy,
    wire::{Input as I, Output as W},
};
use std::{cell::Cell, collections::BTreeSet};
#[path = "worker_bunker_lifetime.rs"]
mod lifetime;
#[path = "worker_bunker_rpc.rs"]
mod rpc;
pub(super) use lifetime::{input, sync};
pub(super) use rpc::{Call, call};
#[path = "worker_bunker_discovery.rs"]
mod discovery;
pub(super) use discovery::{Caller, discover};
#[derive(Default)]
pub(super) struct State {
    book: policy::Book,
    // Same 64-total / 16-per-client admission bound as the core book.
    flights: BTreeMap<policy::Lease, Flight>,
}
struct Flight {
    handle: String,
    controller: web_sys::AbortController,
    reason: Rc<Cell<Option<policy::Reason>>>,
}
pub(super) fn authority(h: &Host, account: &str) -> Option<policy::Authority> {
    h.accounts.require_signer(account).ok()?;
    let entry = h.accounts.entries.iter().find(|a| a.pubkey == account)?;
    let remote = h.accounts.remote(account)?;
    Some(policy::Authority {
        generation: entry.authority(),
        peer: remote.peer.clone(),
        client: remote.client()?,
    })
}
fn context(
    h: &Host,
    extra: Option<&policy::Owner>,
) -> (BTreeSet<u64>, BTreeMap<String, policy::Authority>) {
    if h.stopped {
        return (BTreeSet::new(), BTreeMap::new());
    }
    let mut accounts = BTreeMap::new();
    // Successful credential replacement renews Account::authority. Retain its
    // captured public device key instead of doing scalar multiplication per tick.
    for owner in h.bunker.book.owners().chain(extra) {
        let Some((account, saved)) = &owner.account else {
            continue;
        };
        if h.accounts.require_signer(account).is_ok()
            && h.accounts
                .entries
                .iter()
                .any(|a| a.pubkey == *account && a.authority() == saved.generation)
            && h.accounts
                .remote(account)
                .is_some_and(|r| r.peer == saved.peer)
        {
            accounts.insert(account.clone(), saved.clone());
        }
    }
    (h.sessions.keys().copied().collect(), accounts)
}
fn release(h: &mut Host, ended: policy::Removed) {
    if let Some(flight) = h.bunker.flights.remove(&ended.lease) {
        flight.reason.set(Some(ended.reason));
        if ended.shown {
            h.scope.direct(
                ended.owner.client,
                &W::SignerAuthClear { id: flight.handle },
            );
        }
        if ended.reason != policy::Reason::Finished {
            flight.controller.abort();
        }
    }
}
fn end(h: &mut Host, lease: policy::Lease, reason: policy::Reason) {
    if let Some(ended) = h.bunker.book.finish(lease, reason) {
        release(h, ended);
    }
}
fn announce(
    h: &mut Host,
    lease: policy::Lease,
    url: lkjstr_protocol::remote::AuthUrl,
) -> Result<(), &'static str> {
    sync(h);
    let at = h.time();
    if !h.bunker.book.challenge(lease, &url, at)? {
        return Ok(());
    }
    let job = h.bunker.book.get(lease).ok_or("offline")?;
    let flight = h.bunker.flights.get(&lease).ok_or("offline")?;
    h.scope.direct(
        job.owner.client,
        &W::SignerAuth {
            id: flight.handle.clone(),
            peer: job.peer.clone(),
            method: job.method.name().into(),
            url: lkjstr_core::engine::accounts::secret::SecretText::new(url.as_str().into()),
            expires_at: job.expires_at,
            account: job
                .owner
                .account
                .as_ref()
                .map(|(account, _)| account.clone()),
            action_req: job.owner.request.clone(),
        },
    );
    Ok(())
}
