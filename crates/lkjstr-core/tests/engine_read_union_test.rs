//! A physical union preserves every view's quota and never replays a surviving member.
#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::*;
use lkjstr_core::{
    engine::protocol::{Query, Source},
    store::Store,
};
use lkjstr_protocol::{NostrFilter, matches_filter, parse_filter_value};
use serde_json::{Value, json};
use std::collections::BTreeSet;

#[test]
fn five_overlapping_views_share_envelopes_without_borrowing_a_home_quota() {
    for cap in [1, 2, 8] {
        let (wants, events, store) = fixture();
        let mut n = setup(cap, 4);
        if cap == 1 {
            n.relays.get_mut(R).expect("relay").max_reqs = 8;
        }
        let reqs = acquire(&mut n, wants.clone(), &store);
        assert_eq!(
            reqs.len(),
            match cap {
                1 => 5,
                2 => 3,
                _ => 1,
            }
        );
        let mut obtained = BTreeSet::new();
        for req in &reqs {
            let mut union = BTreeSet::new();
            for f in req.as_array().expect("REQ").iter().skip(2) {
                let f = parse_filter_value(f).expect("filter");
                let mut matching: Vec<_> =
                    events.iter().filter(|e| matches_filter(e, &f)).collect();
                matching.sort_by_key(|e| std::cmp::Reverse((e.created_at, &e.id)));
                union.extend(
                    matching
                        .into_iter()
                        .take(f.limit.expect("own limit") as usize)
                        .map(|e| e.id.clone()),
                );
            }
            for id in union {
                let event = events.iter().find(|e| e.id == id).expect("answer");
                assert!(
                    n.message(R, &json!(["EVENT", req[1], event]).to_string(), NOW + 500)
                        .is_some()
                );
                obtained.insert(id);
            }
            n.message(R, &json!(["EOSE", req[1]]).to_string(), NOW + 501);
        }
        // Home's newest 200 rows belong to person4. Every older selected profile
        // still receives its own two rows, plus the separate notification.
        assert_eq!(obtained.len(), 207);
        for (sub, _, _) in &wants {
            assert_eq!(n.request_progress(sub), (1, 1));
        }
        assert!(!frames(&mut n).iter().any(|f| f[0] == "CLOSE"));
    }
}

#[test]
fn closing_profile_then_home_keeps_the_other_wants_and_rejects_orphan_traffic() {
    let (wants, _, store) = fixture();
    let mut n = setup(8, 4);
    let reqs = acquire(&mut n, wants.clone(), &store);
    let wire = &reqs[0][1];
    let remaining: Vec<_> = wants
        .into_iter()
        .filter(|(s, _, _)| s != "profile0")
        .collect();
    n.plan(remaining.clone(), &store, NOW + 600);
    assert!(
        frames(&mut n).is_empty(),
        "closing a profile must not replay Home"
    );
    n.plan(
        remaining
            .into_iter()
            .filter(|(s, _, _)| s != "home")
            .collect(),
        &store,
        NOW + 700,
    );
    assert!(
        frames(&mut n).is_empty(),
        "closing Home must not replay the profiles"
    );
    let orphan = event(1, 100, 1, vec![]);
    assert!(
        n.message(R, &json!(["EVENT", wire, orphan]).to_string(), NOW + 701)
            .is_none()
    );
    let retained = event(2, 101, 1, vec![]);
    assert!(
        n.message(R, &json!(["EVENT", wire, retained]).to_string(), NOW + 702)
            .is_some()
    );
    n.plan(vec![], &store, NOW + 800);
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "CLOSE").count(), 1);
    assert!(n.open_wires().is_empty());
}

#[test]
fn a_shared_unanswered_focus_cannot_be_preempted_through_another_member() {
    let (mut wants, _, store) = fixture();
    let mut n = setup(8, 1);
    let reqs = acquire(&mut n, wants.clone(), &store);
    wants.push((
        "people".into(),
        NostrFilter {
            authors: Some(vec!["b".repeat(64)]),
            kinds: Some(vec![0]),
            limit: Some(1),
            ..Default::default()
        },
        Query {
            source: Source::People,
            ..Default::default()
        },
    ));
    n.plan(wants, &store, NOW + 600);
    n.tick(NOW + 700);
    assert!(
        frames(&mut n).is_empty(),
        "every member protects the focused wire"
    );
    n.message(R, &json!(["EOSE", reqs[0][1]]).to_string(), NOW + 701);
    n.tick(NOW + 702);
    let changes = frames(&mut n);
    assert_eq!(changes.iter().filter(|f| f[0] == "CLOSE").count(), 1);
    let profile = changes
        .iter()
        .find(|f| f[0] == "REQ")
        .expect("metadata can now acquire slot");
    n.message(R, &json!(["EOSE", profile[1]]).to_string(), NOW + 703);
    frames(&mut n);
    n.tick(NOW + 704);
    let resumed = frames(&mut n);
    assert_eq!(resumed.iter().filter(|f| f[0] == "REQ").count(), 1);
    assert!(
        !resumed.iter().any(|f| f[0] == "CLOSE"),
        "a finite hydration releases the slot back to one shared live envelope"
    );
}

#[test]
fn private_projection_and_encrypted_streams_do_not_share_public_live_envelopes() {
    let (wants, _, _) = fixture();
    let mut wants: Vec<_> = wants.into_iter().take(2).collect();
    let policy = event(8, 1, 10000, vec![]);
    for (_, _, q) in &mut wants {
        q.account = Some(policy.pubkey.clone());
    }
    let mut store = Store::new(10);
    store.insert(policy.clone(), None);
    let private = [(policy.id, vec![vec!["p".into(), "f".repeat(64)]])]
        .into_iter()
        .collect();
    let mut n = setup(8, 4);
    n.plan_with_lists(wants.clone(), &store, &private, NOW);
    n.connected(R, NOW + 1);
    n.tick(NOW + 101);
    assert_eq!(frames(&mut n).iter().filter(|f| f[0] == "REQ").count(), 2);
    let mut n = setup(8, 4);
    for (_, f, _) in &mut wants {
        f.kinds = Some(vec![1059]);
    }
    assert_eq!(acquire(&mut n, wants, &store).len(), 2);
}

#[test]
fn rejected_live_union_falls_back_to_independent_filters_without_false_completion() {
    let (wants, _, store) = fixture();
    let mut n = setup(8, 4);
    let wants: Vec<_> = wants.into_iter().take(2).collect();
    let initial = acquire(&mut n, wants, &store);
    n.message(
        R,
        &json!(["CLOSED", initial[0][1], "unsupported filters"]).to_string(),
        NOW + 500,
    );
    n.tick(NOW + 601);
    let mut frames = engine_read_union_support::frames(&mut n);
    n.tick(NOW + 701);
    frames.extend(engine_read_union_support::frames(&mut n));
    let reqs: Vec<&Value> = frames.iter().filter(|f| f[0] == "REQ").collect();
    assert_eq!(reqs.len(), 2);
    assert!(reqs.iter().all(|r| r.as_array().expect("REQ").len() == 3));
    assert_eq!(n.request_progress("home"), (1, 0));
}
