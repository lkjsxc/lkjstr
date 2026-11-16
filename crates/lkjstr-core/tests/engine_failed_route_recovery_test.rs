//! Preserve pending envelopes and configured-route uncertainty across page changes.
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
const C: &str = "wss://c.test/";
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
    for relay in [A, B, C] {
        if n.relays.get(relay).is_some_and(|r| r.connecting) {
            n.connected(relay, now);
        }
    }
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
fn delayed_retry_keeps_its_wire_identity_and_original_span_during_advance() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into()], 0);
    let head = NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(2),
        ..Default::default()
    };
    plan(&mut n, &head, 0);
    let first = frames(&mut n);
    answer(&mut n, A, &first[A], &[100, 90], 2);
    n.tick(16000);
    frames(&mut n);
    n.tick(17001);
    let retry = frames(&mut n);
    assert!(n.page_finished(&head));
    let page = NostrFilter {
        until: Some(90),
        ..head
    };
    plan(&mut n, &page, 17200);
    let next = frames(&mut n);
    assert!(
        !next.contains_key(B),
        "the in-flight original page is not cancelled and replayed"
    );
    answer(&mut n, A, &next[A], &[90, 80], 17201);
    answer(&mut n, B, &retry[B], &[99, 95], 17202);
    assert_eq!(n.page_cursor(&page), Some(95));
    assert!(!n.page_exhausted(&page));
}
#[test]
fn reranking_retains_failed_route_uncertainty_until_reader_removes_the_route() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], 0);
    let head = NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(2),
        ..Default::default()
    };
    plan(&mut n, &head, 0);
    let first = frames(&mut n);
    assert_eq!(first.len(), 2);
    answer(&mut n, A, &first[A], &[100, 90], 2);
    n.message(
        B,
        &json!(["CLOSED", first[B][1], "blocked: unavailable"]).to_string(),
        3,
    );
    let page = NostrFilter {
        until: Some(90),
        ..head
    };
    plan(&mut n, &page, 200);
    let next = frames(&mut n);
    assert!(
        next.contains_key(C),
        "quality can choose a fresh healthy route"
    );
    assert!(
        !next.contains_key(B),
        "refused route is retained without a retry storm"
    );
    answer(&mut n, A, &next[A], &[], 201);
    answer(&mut n, C, &next[C], &[], 201);
    assert!(
        !n.page_exhausted(&page),
        "unanswered B cannot silently disappear from completeness"
    );
    assert_eq!(n.request_progress("feed").0, 3);
    n.known.get_mut(B).expect("known B").read = false;
    plan(&mut n, &page, 400);
    assert!(
        n.page_exhausted(&page),
        "explicitly disabled B no longer belongs to this view"
    );
}
