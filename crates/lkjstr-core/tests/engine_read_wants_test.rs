//! Canonical wants preserve logical limits and subtract only locally answered immutable IDs.
#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::*;
use lkjstr_core::{
    engine::protocol::{Query, Source},
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::json;

#[test]
fn permuted_sets_share_one_request_and_keep_both_owners() {
    let mut n = setup(1, 4);
    let mut a = NostrFilter {
        authors: Some(vec!["b".repeat(64), "a".repeat(64)]),
        kinds: Some(vec![6, 1, 6]),
        limit: Some(200),
        ..Default::default()
    };
    a.tags
        .insert("t".into(), vec!["rust".into(), "wasm".into()]);
    let mut b = a.clone();
    b.authors.as_mut().expect("authors").reverse();
    b.kinds = Some(vec![1, 6]);
    b.tags.insert(
        "t".into(),
        vec!["wasm".into(), "rust".into(), "rust".into()],
    );
    let wants = vec![
        ("one".into(), a.clone(), Query::default()),
        ("two".into(), b.clone(), Query::default()),
    ];
    let reqs = acquire(&mut n, wants.clone(), &Store::new(0));
    assert_eq!(reqs.len(), 1);
    assert_eq!(n.request_stats()[0]["members"], 2);
    n.plan(vec![wants[1].clone()], &Store::new(0), NOW + 600);
    assert!(frames(&mut n).is_empty());
    // Different quotas are separate logical obligations, even for the same set.
    a.limit = Some(1);
    n.plan(
        vec![
            ("two".into(), b, Query::default()),
            ("three".into(), a, Query::default()),
        ],
        &Store::new(0),
        NOW + 700,
    );
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "REQ").count(), 1);
}

#[test]
fn held_ids_are_removed_before_routes_and_do_not_reset_an_inflight_bucket() {
    let events = [event(1, 1, 1, vec![]), event(2, 2, 1, vec![])];
    let f = NostrFilter {
        ids: Some(events.iter().map(|e| e.id.clone()).collect()),
        limit: Some(2),
        ..Default::default()
    };
    let want = ("held".into(), f, Query::default());
    let mut n = setup(1, 4);
    let mut store = Store::new(10);
    let reqs = acquire(&mut n, vec![want.clone()], &store);
    assert_eq!(reqs.len(), 1);
    store.insert(events[0].clone(), None);
    n.plan(vec![want.clone()], &store, NOW + 600);
    assert!(
        frames(&mut n).is_empty(),
        "known member must not replay the still-missing member"
    );
    store.insert(events[1].clone(), None);
    n.plan(vec![want.clone()], &store, NOW + 700);
    assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
    let mut next = setup(1, 4);
    assert!(
        acquire(&mut next, vec![want], &store).is_empty(),
        "fresh planner asks no held exact IDs"
    );
}

#[test]
fn explicit_relay_provenance_and_internal_remote_proof_are_not_inferred_from_a_body() {
    let event = event(1, 1, 1, vec![]);
    let mut store = Store::new(10);
    store.insert(event.clone(), Some("wss://other.test/"));
    let f = NostrFilter {
        ids: Some(vec![event.id.clone()]),
        limit: Some(1),
        ..Default::default()
    };
    for (sub, q) in [
        (
            "relay",
            Query {
                source: Source::Relay,
                target: Some(R.into()),
                ..Default::default()
            },
        ),
        ("~publication:proof", Query::default()),
    ] {
        let mut n = setup(1, 4);
        assert_eq!(
            acquire(&mut n, vec![(sub.into(), f.clone(), q)], &store).len(),
            1
        );
    }
    store.insert(event, Some(R));
    let mut n = setup(1, 4);
    assert!(
        acquire(
            &mut n,
            vec![(
                "relay".into(),
                f,
                Query {
                    source: Source::Relay,
                    target: Some(R.into()),
                    ..Default::default()
                }
            )],
            &store
        )
        .is_empty()
    );
}

#[test]
fn live_slot_rotation_applies_one_cooldown_to_every_shared_member() {
    let (mut wants, _, store) = fixture();
    let mut n = setup(8, 1);
    let reqs = acquire(&mut n, wants.clone(), &store);
    n.message(R, &json!(["EOSE", reqs[0][1]]).to_string(), NOW + 500);
    frames(&mut n);
    let mut counts = NostrFilter {
        kinds: Some(vec![1, 6, 7, 9735]),
        limit: Some(200),
        ..Default::default()
    };
    counts.tags.insert("e".into(), vec!["e".repeat(64)]);
    wants.push(("counts".into(), counts, Query::default()));
    n.plan(wants, &store, NOW + 600);
    n.tick(NOW + 700);
    let changed = frames(&mut n);
    assert_eq!(changed.iter().filter(|f| f[0] == "CLOSE").count(), 1);
    let counts = changed
        .iter()
        .find(|f| f[0] == "REQ")
        .expect("count stream");
    assert!(counts[2]["#e"].is_array());
    n.message(R, &json!(["EOSE", counts[1]]).to_string(), NOW + 701);
    n.tick(NOW + 702);
    assert!(!frames(&mut n).iter().any(|f| f[0] == "REQ"));
    n.tick(NOW + 1700);
    let resumed = frames(&mut n);
    assert_eq!(resumed.iter().filter(|f| f[0] == "CLOSE").count(), 1);
    let resumed: Vec<_> = resumed.iter().filter(|f| f[0] == "REQ").collect();
    assert_eq!(resumed.len(), 1);
    assert_eq!(resumed[0].as_array().expect("union").len(), 7);
}
