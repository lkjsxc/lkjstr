#![allow(clippy::unwrap_used)]
use lkjstr_core::engine::zaps::*;
use std::collections::{BTreeMap, BTreeSet};
fn id(n: usize) -> String {
    format!("{n:064x}")
}
fn pending(ids: &[String]) -> ReadSnapshot {
    ReadSnapshot {
        pending: ids.iter().cloned().collect(),
        ..Default::default()
    }
}
#[test]
fn old_pending_receipt_survives_repeated_seen_and_reload_until_authorized_ack() {
    let raw = id(1);
    let mut state = ReadState::default();
    state.acknowledge(pending(std::slice::from_ref(&raw)));
    state.acknowledge(pending(std::slice::from_ref(&raw)));
    let mut state: ReadState =
        serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
    assert!(state.is_unread(&raw, "payment", &BTreeSet::new(), false));
    state.acknowledge(ReadSnapshot {
        payments: BTreeMap::from([(raw.clone(), "payment".into())]),
        acknowledged: BTreeSet::from(["payment".into()]),
        ..Default::default()
    });
    assert!(!state.is_unread(&raw, "payment", &BTreeSet::new(), false));
    assert_eq!(state.deferred().count(), 0);
}
#[test]
fn canonical_duplicate_changes_do_not_resurrect_an_acknowledged_payment() {
    let (first, second, unknown) = (id(1), id(2), id(3));
    let mut state = ReadState::default();
    state.acknowledge(pending(&[first.clone(), second.clone(), unknown]));
    let aliases = BTreeSet::from(["one-payment".into()]);
    assert!(state.is_unread(&id(4), "one-payment", &aliases, false));
    state.acknowledge(ReadSnapshot {
        payments: BTreeMap::from([
            (first, "one-payment".into()),
            (second, "one-payment".into()),
        ]),
        acknowledged: BTreeSet::from(["one-payment".into()]),
        ..Default::default()
    });
    assert!(!state.is_unread(&id(4), "one-payment", &aliases, true));
    assert_eq!(state.deferred().count(), 1);
}
#[test]
fn trust_before_seen_snapshot_is_acknowledged_without_creating_an_exception() {
    let mut state = ReadState::default();
    state.acknowledge(ReadSnapshot {
        acknowledged: BTreeSet::from(["known".into()]),
        ..Default::default()
    });
    let state: ReadState = serde_json::from_str(&serde_json::to_string(&state).unwrap()).unwrap();
    assert!(!state.is_unread(&id(2), "known", &BTreeSet::new(), true));
    assert_eq!(state.deferred().count(), 0);
}
#[test]
fn finite_overflow_is_explicit_and_conservative_instead_of_losing_new_candidates() {
    let mut state = ReadState::default();
    state.acknowledge(pending(&(0..6001).map(id).collect::<Vec<_>>()));
    assert_eq!(state.deferred().count(), 6000);
    assert!(state.limited);
    let omitted = id(6000);
    assert!(state.is_unread(&omitted, "new-payment", &BTreeSet::new(), false));
    state.acknowledge(ReadSnapshot {
        acknowledged: BTreeSet::from(["new-payment".into()]),
        ..Default::default()
    });
    assert!(!state.is_unread(&omitted, "new-payment", &BTreeSet::new(), false));
    assert!(state.limited);
}
