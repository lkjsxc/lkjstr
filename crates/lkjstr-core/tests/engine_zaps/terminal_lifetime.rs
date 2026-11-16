#![allow(clippy::unwrap_used)]
use super::common;
use common::jobs::*;
use common::*;
use lkjstr_core::engine::zaps::*;

fn completed() -> (lkjstr_core::store::Store, State, InvoiceWork) {
    let (store, mut state, work) = start();
    let (callback, json, response) = invoice_response(&store, &work.requests[0], 101);
    assert!(state.jobs.invoice_response(
        &store,
        work.token,
        0,
        (&json, &callback, Ok(response)),
        101,
    ));
    // Leave the terminal result queued, as between HTTP resolution and Worker pump.
    (store, state, work)
}
#[test]
fn account_lock_revokes_an_undelivered_completed_invoice() {
    let (_, mut state, work) = completed();
    state.jobs.account_changed(&work.account);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::SignerMissing)),
    );
    assert!(state.jobs.outcomes().is_empty());
}
#[test]
fn close_settles_an_undelivered_completed_invoice_once() {
    let (_, mut state, work) = completed();
    state.jobs.close(&work.owner);
    state.jobs.close(&work.owner);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Cancelled)),
    );
    assert!(state.jobs.outcomes().is_empty());
}
#[test]
fn account_change_preserves_another_accounts_completed_invoice() {
    let (_, mut state, work) = completed();
    state.jobs.account_changed(&key(3).public_key());
    assert!(state.jobs.outcomes().remove(&work.owner).unwrap().is_ok());
}
#[test]
fn detached_clients_drop_their_terminal_payload_and_reservation() {
    let (_, mut state, work) = completed();
    state.jobs.detach(work.owner.client);
    assert!(state.jobs.outcomes().is_empty());
    assert!(
        state
            .jobs
            .quote(
                work.owner,
                QuoteInput {
                    target: work.requests[0].target.clone(),
                    amount_msat: None,
                },
                102
            )
            .is_ok()
    );
}
#[test]
fn completed_invoice_keeps_its_deadline_until_emission_after_wake() {
    let (store, mut state, work) = completed();
    tick(&mut state, &store, work.deadline);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Network))
    );
}
#[test]
fn recipient_rotation_revokes_an_undelivered_completed_invoice() {
    let (mut store, mut state, work) = completed();
    profile(&mut store, 2, "changed@elsewhere.test", 2);
    tick(&mut state, &store, 102);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Stale))
    );
}
