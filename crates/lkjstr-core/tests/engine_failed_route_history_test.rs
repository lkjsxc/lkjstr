//! A failed or delayed relay cannot stop a healthy archive or lose its own gap.
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
use std::collections::BTreeMap;
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
fn frames(n: &mut Network) -> BTreeMap<String, Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|effect| {
            let Effect::Send(url, text) = effect else {
                return None;
            };
            let value: Value = serde_json::from_str(&text).expect("frame");
            (value[0] == "REQ").then_some((url, value))
        })
        .collect()
}
fn plan(n: &mut Network, f: &NostrFilter, now: u64) {
    n.plan(
        vec![("feed".into(), f.clone(), Query::default())],
        &Store::new(0),
        now,
    );
    for relay in [A, B] {
        if n.relays.get(relay).is_some_and(|r| r.connecting) {
            n.connected(relay, now);
        }
    }
}
fn setup(until: Option<u64>, limit: u64) -> (Network, NostrFilter, BTreeMap<String, Value>) {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into()], 0);
    let f = NostrFilter {
        kinds: Some(vec![1]),
        until,
        limit: Some(limit),
        ..Default::default()
    };
    plan(&mut n, &f, 0);
    n.connected(A, 1);
    n.connected(B, 1);
    let requests = frames(&mut n);
    assert_eq!(requests.len(), 2);
    (n, f, requests)
}
fn answer(n: &mut Network, relay: &str, req: &Value, times: &[u64], now: u64) {
    for at in times {
        let e = support::event(*at, 1, "public archive", vec![]);
        assert!(
            n.message(relay, &json!(["EVENT", req[1], e]).to_string(), now)
                .is_some()
        );
    }
    n.message(relay, &json!(["EOSE", req[1]]).to_string(), now + 1);
}
#[test]
fn a_closed_route_does_not_block_two_thousand_healthy_notes_or_claim_exhaustion() {
    let (mut n, mut page, requests) = setup(None, 200);
    n.message(
        B,
        &json!(["CLOSED", requests[B][1], "blocked: unavailable"]).to_string(),
        2,
    );
    let mut request = requests[A].clone();
    let mut high = 3000;
    let mut distinct = std::collections::BTreeSet::new();
    for batch in 0..11 {
        let times: Vec<_> = (high - 199..=high).rev().collect();
        distinct.extend(times.iter().copied());
        let now = 200 + batch * 200;
        answer(&mut n, A, &request, &times, now);
        assert!(
            n.page_finished(&page),
            "CLOSED is not a veto on a healthy completed page"
        );
        assert!(
            !n.page_exhausted(&page),
            "a failed route never proves its archive empty"
        );
        high = n.page_cursor(&page).expect("healthy cursor");
        page.until = Some(high);
        plan(&mut n, &page, now + 100);
        let requests = frames(&mut n);
        assert!(
            !requests.contains_key(B),
            "terminal refusal must not become a retry storm"
        );
        request = requests.get(A).expect("next healthy page").clone();
    }
    assert!(distinct.len() >= 2000);
    answer(&mut n, A, &request, &[], 3000);
    assert!(!n.page_exhausted(&page));
    n.plan(vec![], &Store::new(0), 3100);
    assert_eq!(n.request_progress("feed"), (0, 0));
}
#[test]
fn timed_out_route_replays_its_original_page_and_recovers_the_gap() {
    let (mut n, head, initial) = setup(Some(100), 2);
    answer(&mut n, A, &initial[A], &[100, 90], 2);
    assert!(
        !n.page_finished(&head),
        "a still timely route may finish its first page"
    );
    n.tick(16000);
    frames(&mut n);
    assert!(
        n.page_finished(&head),
        "expiry lets the healthy route advance"
    );
    let page = NostrFilter {
        until: Some(90),
        ..head.clone()
    };
    plan(&mut n, &page, 17001);
    let second = frames(&mut n);
    assert_eq!(
        second[B][2]["until"], 100,
        "B must not inherit A's until=90 and lose 95"
    );
    answer(&mut n, A, &second[A], &[90, 80], 17002);
    answer(&mut n, B, &second[B], &[99, 95], 17003);
    assert_eq!(n.page_cursor(&page), Some(95));
    let recovered = NostrFilter {
        until: Some(95),
        ..head
    };
    plan(&mut n, &recovered, 17200);
    let third = frames(&mut n);
    assert_eq!(
        third[A][2]["until"], 80,
        "healthy A must not rewind for B's backfill"
    );
    assert_eq!(third[B][2]["until"], 95);
    answer(&mut n, A, &third[A], &[], 17201);
    answer(&mut n, B, &third[B], &[95], 17201);
    assert!(n.page_exhausted(&recovered));
}
#[test]
fn partial_failed_answers_cannot_supply_a_cursor_without_successful_eose() {
    let (mut n, page, initial) = setup(None, 2);
    for at in [100, 99] {
        let event = support::event(at, 1, "unfinished", vec![]);
        n.message(B, &json!(["EVENT", initial[B][1], event]).to_string(), 2);
    }
    n.message(
        B,
        &json!(["CLOSED", initial[B][1], "blocked: unavailable"]).to_string(),
        3,
    );
    answer(&mut n, A, &initial[A], &[90, 80], 4);
    assert_eq!(
        n.page_cursor(&page),
        Some(80),
        "failed B must not choose 99"
    );
}
