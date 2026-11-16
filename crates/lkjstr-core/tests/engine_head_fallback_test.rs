//! Unavailable routes cannot occupy both healthy live-feed slots forever.
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
const W: &str = "wss://write-only.test/";
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
fn plan(n: &mut Network, filter: &NostrFilter, now: u64) {
    n.plan(
        vec![("feed".into(), filter.clone(), Query::default())],
        &Store::new(0),
        now,
    );
}
#[test]
fn failed_connection_gives_a_healthy_reader_the_live_slot() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into(), W.into()], 0);
    n.known.get_mut(W).expect("known").read = false;
    let filter = NostrFilter {
        kinds: Some(vec![1, 6]),
        limit: Some(2),
        ..Default::default()
    };
    plan(&mut n, &filter, 0);
    n.connected(A, 1);
    let first = frames(&mut n);
    n.message(A, &json!(["EOSE", first[A][1]]).to_string(), 2);
    // B never established a socket, so it has no request/page deadline.
    n.disconnected(B, 3);
    plan(&mut n, &filter, 4);
    assert!(
        n.relays[C].connecting,
        "a healthy permitted reader must replace the unavailable slot"
    );
    n.connected(C, 5);
    let next = frames(&mut n);
    assert!(next.contains_key(C));
    assert!(!next.contains_key(B));
    assert!(
        !next.contains_key(W),
        "write-only routes are not implicit readers"
    );
    let event = support::event(50, 1, "unique healthy fallback note", vec![]);
    assert!(
        n.message(C, &json!(["EVENT", next[C][1], event]).to_string(), 6)
            .is_some()
    );
    n.message(C, &json!(["EOSE", next[C][1]]).to_string(), 7);
    assert!(
        n.page_finished(&filter),
        "a connection failure has no wire deadline to wait for"
    );
    assert!(!n.page_exhausted(&filter), "B is still unknown, not empty");
    plan(&mut n, &filter, 8);
    assert!(
        frames(&mut n).is_empty(),
        "healthy fallback must not churn on each replan"
    );
}
#[test]
fn refused_historical_route_preserves_uncertainty_after_fallback_completes() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], 0);
    let filter = NostrFilter {
        kinds: Some(vec![1]),
        until: Some(100),
        ..Default::default()
    };
    plan(&mut n, &filter, 0);
    n.connected(A, 1);
    n.connected(B, 1);
    let first = frames(&mut n);
    n.message(A, &json!(["EOSE", first[A][1]]).to_string(), 2);
    n.message(
        B,
        &json!(["CLOSED", first[B][1], "blocked: unavailable"]).to_string(),
        3,
    );
    plan(&mut n, &filter, 4);
    n.connected(C, 5);
    let next = frames(&mut n);
    assert!(
        next.contains_key(C),
        "refused route must allow a healthy reader"
    );
    n.message(C, &json!(["EOSE", next[C][1]]).to_string(), 6);
    plan(&mut n, &filter, 7);
    assert!(n.page_finished(&filter));
    assert!(
        !n.page_exhausted(&filter),
        "C's empty answer does not prove B's history empty"
    );
    assert_eq!(n.request_progress("feed").0, 3);
}

#[test]
fn recovered_primary_does_not_evict_a_working_live_fallback() {
    for answered_before_failure in [false, true] {
        let mut n = Network::default();
        n.configure(vec![A.into(), B.into(), C.into()], 0);
        let filter = NostrFilter {
            kinds: Some(vec![1, 6]),
            limit: Some(2),
            ..Default::default()
        };
        plan(&mut n, &filter, 0);
        n.connected(A, 1);
        n.connected(B, 1);
        let first = frames(&mut n);
        n.message(A, &json!(["EOSE", first[A][1]]).to_string(), 2);
        if answered_before_failure {
            n.message(B, &json!(["EOSE", first[B][1]]).to_string(), 2);
        }
        n.disconnected(B, 3);
        plan(&mut n, &filter, 4);
        n.connected(C, 5);
        let fallback = frames(&mut n);
        assert!(fallback.contains_key(C));
        n.message(C, &json!(["EOSE", fallback[C][1]]).to_string(), 6);
        plan(&mut n, &filter, 7);
        n.drain_effects();
        n.connected(B, 2008);
        let recovery = frames(&mut n);
        assert!(
            recovery.contains_key(B),
            "the unresolved route must still recover"
        );
        plan(&mut n, &filter, 2009);
        assert_eq!(
            n.request_progress("feed").0,
            3,
            "B's resumed gap remains owned before its new EOSE"
        );
        let gap = support::event(1, 1, "recovered route's unique gap note", vec![]);
        assert!(
            n.message(B, &json!(["EVENT", recovery[B][1], gap]).to_string(), 2010)
                .is_some()
        );
        n.message(B, &json!(["EOSE", recovery[B][1]]).to_string(), 2011);
        plan(&mut n, &filter, 2012);
        let effects = n.drain_effects();
        assert!(
            effects.iter().all(|effect| {
                !matches!(effect, Effect::Send(url, text)
                if url == C && serde_json::from_str::<Value>(text).is_ok_and(|v| v[0] == "CLOSE"))
            }),
            "recovering an earlier configured relay must not close a healthy fallback: {effects:?}"
        );
        let event = support::event(2, 1, "later note only on healthy fallback", vec![]);
        assert!(
            n.message(
                C,
                &json!(["EVENT", fallback[C][1], event]).to_string(),
                2013
            )
            .is_some()
        );
        assert_eq!(
            n.request_progress("feed").0,
            2,
            "completed recovery releases its extra route"
        );
        n.known.get_mut(C).expect("known").read = false;
        plan(&mut n, &filter, 2014);
        assert!(
            n.drain_effects().iter().any(|effect| {
                matches!(effect, Effect::Send(url, text)
                if url == C && serde_json::from_str::<Value>(text).is_ok_and(|v| v[0] == "CLOSE"))
            }),
            "revoking read permission releases the fallback immediately"
        );
        n.plan(Vec::new(), &Store::new(0), 2015);
        assert_eq!(
            n.request_progress("feed").0,
            0,
            "hiding the final view releases all wants"
        );
        assert!(n.open_wires().is_empty());
    }
}
