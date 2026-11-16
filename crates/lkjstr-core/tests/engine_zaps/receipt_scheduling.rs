#![allow(clippy::unwrap_used)]
use super::common::*;
use lkjstr_core::engine::zaps::{Coverage, Owner, ReceiptInput, State, Target};
use std::collections::BTreeMap;

fn pending_background(urgent: bool) {
    let (mut store, mut providers, background) = setup();
    profile(&mut store, 3, "bob@ln.test", 1);
    let note = event(3, 1, vec![], "newly requested target", 2);
    let selected = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    ready(&store, &mut providers, 3, 100);
    let request = prepared(&store, &providers, &background, 100);
    for n in 0..64 {
        store.insert(receipt(&request, 110 + n), None);
    }
    let mut state = State::default();
    state.providers = providers;
    state.tick(
        &store,
        std::slice::from_ref(&background),
        &BTreeMap::new(),
        &BTreeMap::new(),
        200,
    );
    let pending = state.receipts.pending();
    assert_eq!(pending, 60);
    let receipt = receipt(&prepared(&store, &state.providers, &selected, 200), 201);
    store.insert(receipt.clone(), None);
    let mut coverage = BTreeMap::new();
    if urgent {
        state
            .jobs
            .receipts(
                Owner {
                    client: 1,
                    req: "explicit-next-target".into(),
                },
                ReceiptInput {
                    target: selected.clone(),
                    before: None,
                    limit: 20,
                },
                201,
            )
            .unwrap();
        coverage.insert(selected.clone(), Coverage::Observed);
    }
    let visible = if urgent { background } else { selected };
    state.tick(&store, &[visible], &coverage, &BTreeMap::new(), 201);
    assert!(
        state.receipts.get(&store, &receipt.id).is_some(),
        "new demand waited behind unrelated warm receipt candidates"
    );
    assert!(state.receipts.pending() >= pending - 3);
    if !urgent {
        assert_eq!(
            state.receipts.pending(),
            pending,
            "hidden targets must not consume the visible validation slice"
        );
    }
}

#[test]
fn explicit_query_validates_before_a_warm_unrelated_backlog() {
    pending_background(true);
}
#[test]
fn new_visible_target_does_not_wait_for_hidden_receipts() {
    pending_background(false);
}
