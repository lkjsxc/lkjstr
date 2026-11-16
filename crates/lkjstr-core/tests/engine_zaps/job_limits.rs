#![allow(clippy::unwrap_used)]
use super::common;
use common::jobs::*;
use common::*;
use lkjstr_core::engine::zaps::*;
#[test]
fn finite_quotes_fail_honestly_and_closing_visible_demand_aborts_provider_http() {
    let (store, _, target) = setup();
    let mut state = State::default();
    state
        .jobs
        .quote(
            owner("quote"),
            QuoteInput {
                target,
                amount_msat: None,
            },
            100,
        )
        .unwrap();
    tick(&mut state, &store, 100);
    let work = state.effects();
    assert_eq!(work.providers.len(), 1);
    assert!(
        matches!(state.jobs.replies().remove(&owner("quote")), Some(QueryReply::Quote(q)) if q.phase == Phase::Loading)
    );
    state.jobs.close(&owner("quote"));
    tick(&mut state, &store, 101);
    assert_eq!(
        state.effects().abort_providers,
        vec![work.providers[0].token]
    );
    assert!(!state.provider_response(
        &store,
        &work.providers[0],
        Ok(response(&work.providers[0].binding, 4)),
        101
    ));
    let missing = Target::Event {
        id: "11".repeat(32),
    };
    state
        .jobs
        .quote(
            owner("missing"),
            QuoteInput {
                target: missing,
                amount_msat: None,
            },
            101,
        )
        .unwrap();
    tick(&mut state, &store, 121);
    assert!(
        matches!(state.jobs.replies().remove(&owner("missing")), Some(QueryReply::Quote(q)) if q.phase == Phase::Failed && q.error == Some(Failure::Network))
    );
}
#[test]
fn independent_bounds_reject_unbounded_query_and_invoice_work() {
    let (store, providers, target) = setup();
    let mut state = State::default();
    state.providers = providers;
    for n in 0..16 {
        state
            .jobs
            .quote(
                owner(&format!("q{n}")),
                QuoteInput {
                    target: target.clone(),
                    amount_msat: None,
                },
                100,
            )
            .unwrap();
    }
    assert_eq!(
        state.jobs.quote(
            owner("q-over"),
            QuoteInput {
                target: target.clone(),
                amount_msat: None
            },
            100
        ),
        Err(Failure::TooLarge)
    );
    for n in 0..4 {
        state
            .jobs
            .invoice(
                owner(&format!("i{n}")),
                key(1).public_key(),
                input(&target),
                vec!["wss://relay.test".into()],
                100,
            )
            .unwrap();
    }
    assert_eq!(
        state.jobs.invoice(
            owner("i-over"),
            key(1).public_key(),
            input(&target),
            vec!["wss://relay.test".into()],
            100
        ),
        Err(Failure::TooLarge)
    );
    tick(&mut state, &store, 100);
    assert_eq!(state.effects().invoices.len(), 4);
}
#[test]
fn request_ownership_spans_terminal_queue_and_is_separate_for_each_client() {
    let (store, mut state, work) = start();
    assert!(state.jobs.owns(&work.owner));
    assert_eq!(
        state.jobs.invoice(
            work.owner.clone(),
            work.account.clone(),
            input(&work.requests[0].target),
            vec!["wss://relay.test".into()],
            101
        ),
        Err(Failure::Rejected)
    );
    assert!(state.jobs.outcomes().is_empty());
    let other = Owner {
        client: work.owner.client + 1,
        req: work.owner.req.clone(),
    };
    assert!(!state.jobs.owns(&other));
    assert!(
        state
            .jobs
            .quote(
                other.clone(),
                QuoteInput {
                    target: work.requests[0].target.clone(),
                    amount_msat: None
                },
                101
            )
            .is_ok()
    );
    state.jobs.close(&work.owner);
    assert!(state.jobs.owns(&work.owner));
    assert!(state.jobs.owns(&other));
    assert_eq!(
        state.jobs.outcomes().remove(&work.owner),
        Some(Err(Failure::Cancelled))
    );
    assert!(!state.jobs.owns(&work.owner));
    state.jobs.detach(other.client);
    assert!(!state.jobs.owns(&other));
    tick(&mut state, &store, 102);
}
