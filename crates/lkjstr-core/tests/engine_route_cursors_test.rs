//! Asymmetric relay tails: advance separately, finish only the union.
#![allow(clippy::expect_used)]
#[path = "engine_review_support/mod.rs"]
mod support;
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
fn frames(n: &mut Network) -> Vec<(String, Value)> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(u, s) => {
                let f: Value = serde_json::from_str(&s).expect("frame");
                (f[0] == "REQ").then_some((u, f))
            }
            _ => None,
        })
        .collect()
}
#[test]
fn independent_cursors_retain_exhausted_routes_and_union_completion() {
    let baseline = std::env::var_os("LKJSTR_CURSOR_BASELINE").is_some();
    let events: std::collections::BTreeMap<_, _> = [100, 90, 50, 20]
        .into_iter()
        .map(|at| (at, support::event(at, 1, "tail", vec![])))
        .collect();
    let mut obtained = std::collections::BTreeSet::new();
    let mut n = Network::default();
    let store = Store::new(0);
    n.configure(vec![A.into(), B.into()], 0);
    let head = NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(2),
        ..Default::default()
    };
    let plan = |n: &mut Network, f: &NostrFilter, now| {
        n.plan(
            vec![("feed".into(), f.clone(), Query::default())],
            &store,
            now,
        )
    };
    plan(&mut n, &head, 0);
    for u in [A, B] {
        n.connected(u, 1);
    }
    let initial = frames(&mut n);
    assert_eq!(initial.len(), 2);
    for (url, frame) in &initial {
        for at in if url == A { [100, 90] } else { [100, 50] } {
            obtained.insert(events[&at].id.clone());
            n.message(url, &json!(["EVENT", frame[1], events[&at]]).to_string(), 2);
        }
        n.message(url, &json!(["EOSE", frame[1]]).to_string(), 3);
    }
    assert_eq!(n.page_cursor(&head), Some(90));
    let page = NostrFilter {
        until: Some(90),
        ..head.clone()
    };
    plan(&mut n, &page, 200);
    let second = frames(&mut n);
    assert_eq!(second.len(), 2);
    for (url, frame) in &second {
        assert_eq!(
            frame[2]["until"],
            if url == A || baseline { 90 } else { 50 }
        );
        // A ends; B still has a full page.
        if url == B {
            for at in [50, 20] {
                obtained.insert(events[&at].id.clone());
                n.message(
                    url,
                    &json!(["EVENT", frame[1], events[&at]]).to_string(),
                    201,
                );
            }
        }
        n.message(url, &json!(["EOSE", frame[1]]).to_string(), 202);
    }
    assert!(n.page_finished(&page));
    assert!(!n.page_exhausted(&page));
    let last = NostrFilter {
        until: Some(20),
        ..head
    };
    plan(&mut n, &last, 400);
    let third = frames(&mut n);
    assert_eq!(
        third.len(),
        if baseline { 2 } else { 1 },
        "exhausted A consumes no REQ after the change"
    );
    assert!(third.iter().any(|(url, _)| url == B));
    assert!(!n.page_finished(&last));
    for (url, frame) in &third {
        n.message(url, &json!(["EOSE", frame[1]]).to_string(), 401);
    }
    assert!(n.page_exhausted(&last));
    assert_eq!(obtained.len(), 4);
    println!(
        "cursor scorecard baseline={baseline} routes=2 recall=4/4 reqs={}",
        initial.len() + second.len() + third.len()
    );
}
