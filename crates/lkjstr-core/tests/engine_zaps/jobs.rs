#![allow(clippy::unwrap_used)]
use super::common;
use common::jobs::*;
use common::*;
use lkjstr_core::engine::zaps::*;
#[test]
fn invoice_result_is_an_unpaid_complete_batch_with_exact_amount() {
    let (store, mut state, work) = start();
    let request = &work.requests[0];
    let (callback, json, response) = invoice_response(&store, request, 101);
    assert!(state.jobs.invoice_response(
        &store,
        work.token,
        0,
        (&json, &callback, Ok(response)),
        101
    ));
    let batch = state
        .jobs
        .outcomes()
        .remove(&owner("invoice"))
        .unwrap()
        .unwrap();
    assert_eq!(batch.state, IntentState::Unpaid);
    assert_eq!(batch.amount_msat, 21_000);
    assert_eq!(batch.invoices.len(), 1);
    assert_eq!(batch.invoices[0].amount_msat, batch.amount_msat);
    assert!(
        !state
            .jobs
            .invoice_active(work.token, &work.owner, &work.account, 101)
    );
}
#[test]
fn account_lock_detach_and_reused_request_cannot_resurrect_old_signature() {
    let (store, mut state, work) = start();
    let signed = signed(&work.requests[0]);
    state.jobs.account_changed(&work.account);
    assert_eq!(
        state.jobs.callback(&store, work.token, 0, &signed, 101),
        Err(Failure::Cancelled)
    );
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::SignerMissing))
    );
    assert_eq!(state.effects().abort_invoices, vec![work.token]);
    let next = state
        .jobs
        .invoice(
            work.owner.clone(),
            work.account.clone(),
            input(&work.requests[0].target),
            vec!["wss://relay.test".into()],
            102,
        )
        .unwrap();
    assert!(next > work.token);
    assert!(
        !state
            .jobs
            .invoice_active(work.token, &work.owner, &work.account, 102)
    );
    state.jobs.detach(work.owner.client);
    assert!(
        !state
            .jobs
            .invoice_active(next, &work.owner, &work.account, 102)
    );
    assert!(state.jobs.outcomes().is_empty());
}
#[test]
fn absolute_deadline_and_changed_recipient_metadata_revoke_pending_invoices() {
    let (mut store, mut state, work) = start();
    state.jobs.expire(work.deadline);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Network))
    );
    state.effects();
    let target = work.requests[0].target.clone();
    state
        .jobs
        .invoice(
            owner("second"),
            key(1).public_key(),
            input(&target),
            vec!["wss://relay.test".into()],
            110,
        )
        .unwrap();
    tick(&mut state, &store, 110);
    let work = state.effects().invoices.remove(0);
    profile(&mut store, 2, "changed@elsewhere.test", 2);
    assert_eq!(
        state
            .jobs
            .callback(&store, work.token, 0, &signed(&work.requests[0]), 111),
        Err(Failure::Stale)
    );
    tick(&mut state, &store, 111);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Stale))
    );
}
#[test]
fn failed_split_never_returns_the_successful_partial_invoice() {
    let (mut store, mut providers, _) = setup();
    profile(&mut store, 3, "bob@ln.test", 1);
    ready(&store, &mut providers, 3, 100);
    let note = event(
        2,
        1,
        vec![
            tag(&["zap", &key(2).public_key(), "", "1"]),
            tag(&["zap", &key(3).public_key(), "", "1"]),
        ],
        "",
        2,
    );
    let target = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let mut state = State::default();
    state.providers = providers;
    state
        .jobs
        .invoice(
            owner("split"),
            key(1).public_key(),
            input(&target),
            vec!["wss://relay.test".into()],
            100,
        )
        .unwrap();
    tick(&mut state, &store, 100);
    let work = state.effects().invoices.remove(0);
    assert_eq!(work.requests.len(), 2);
    let (callback, json, response) = invoice_response(&store, &work.requests[0], 101);
    state
        .jobs
        .invoice_response(&store, work.token, 0, (&json, &callback, Ok(response)), 101);
    assert!(state.jobs.outcomes().is_empty());
    state
        .jobs
        .invoice_response(&store, work.token, 1, ("", "", Err(Failure::Network)), 102);
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Network))
    );
}
