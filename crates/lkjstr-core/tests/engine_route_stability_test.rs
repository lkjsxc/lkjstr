#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
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
fn requests(n: &mut Network) -> BTreeMap<String, Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|effect| {
            let Effect::Send(url, text) = effect else {
                return None;
            };
            let frame: Value = serde_json::from_str(&text).expect("frame");
            (frame[0] == "REQ").then_some((url, frame))
        })
        .collect()
}
fn plan(n: &mut Network, filter: &NostrFilter, now: u64) {
    n.plan(
        vec![("feed".into(), filter.clone(), Query::default())],
        &Store::new(0),
        now,
    );
    for url in [A, B, C] {
        if n.relays.get(url).is_some_and(|r| r.connecting) {
            n.connected(url, now);
        }
    }
}
fn setup(until: Option<u64>) -> (Network, NostrFilter, BTreeMap<String, Value>) {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], 0);
    for url in [A, B, C] {
        n.relay_information(url, r#"{"limitation":{"max_limit":3}}"#);
    }
    let filter = NostrFilter {
        kinds: Some(vec![1, 6]),
        until,
        limit: Some(200),
        ..Default::default()
    };
    plan(&mut n, &filter, 1);
    let frames = requests(&mut n);
    assert_eq!(
        frames.keys().map(String::as_str).collect::<Vec<_>>(),
        [A, B]
    );
    (n, filter, frames)
}
#[test]
fn duplicate_and_latency_reranking_preserves_partial_and_completed_pages() {
    for until in [None, Some(100)] {
        let (mut n, filter, frames) = setup(until);
        n.message(A, &json!(["EOSE", frames[A][1]]).to_string(), 2);
        for (i, at) in [100, 90, 80].into_iter().enumerate() {
            // Cached duplicates still count toward a full historical relay page.
            // No event() call: that would credit the relay with a useful arrival.
            n.message(
                B,
                &json!(["EVENT", frames[B][1], event(at, 1, "cached", vec![])]).to_string(),
                3 + i as u64,
            );
            plan(&mut n, &filter, 6 + i as u64);
            assert!(
                requests(&mut n).is_empty(),
                "an unchanged page must retain its routes"
            );
            assert!(!n.page_finished(&filter));
        }
        n.message(B, &json!(["EOSE", frames[B][1]]).to_string(), 2000);
        plan(&mut n, &filter, 2001);
        assert!(requests(&mut n).is_empty());
        assert!(n.page_finished(&filter));
        assert!(!n.page_exhausted(&filter));
        assert_eq!(n.page_cursor(&filter), Some(80));
        assert_eq!(n.request_progress("feed"), (2, 2));

        // A different page can use the now better-ranked C instead of B.
        let next = NostrFilter {
            until: Some(79),
            ..filter
        };
        plan(&mut n, &next, 2100);
        let frames = requests(&mut n);
        assert_eq!(
            frames.keys().map(String::as_str).collect::<Vec<_>>(),
            [A, C]
        );
        assert!(!n.page_finished(&next));
        assert_eq!(n.page_cursor(&next), None);
        n.plan(vec![], &Store::new(0), 2200);
        assert_eq!(n.request_progress("feed"), (0, 0));
    }
}
#[test]
fn stable_routes_still_obey_changed_read_configuration() {
    let (mut n, filter, _) = setup(None);
    n.known.get_mut(B).expect("configured").read = false;
    plan(&mut n, &filter, 200);
    assert_eq!(
        requests(&mut n)
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        [C]
    );
    n.configure(vec![B.into(), C.into()], 300);
    n.known.get_mut(B).expect("configured").read = true;
    plan(&mut n, &filter, 400);
    assert_eq!(
        requests(&mut n)
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        [B]
    );
    assert_eq!(n.request_progress("feed"), (2, 0));
}

#[test]
fn explicit_hint_does_not_displace_either_retained_read_route() {
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into(), C.into()], 0);
    n.relays.get_mut(A).expect("relay").failures = 4;
    let filter = NostrFilter {
        kinds: Some(vec![1, 6]),
        ..Default::default()
    };
    let mut query = Query::default();
    query.filters.relay_hints = vec![A.into()];
    let wants = vec![("feed".into(), filter, query)];
    n.plan(wants.clone(), &Store::new(0), 0);
    for url in [A, B, C] {
        n.connected(url, 1);
    }
    assert_eq!(requests(&mut n).len(), 3);
    assert_eq!(n.request_progress("feed"), (3, 0));
    n.relays.get_mut(C).expect("relay").received = 100;
    n.plan(wants, &Store::new(0), 200);
    assert_eq!(n.request_progress("feed"), (3, 0));
    assert!(
        n.drain_effects().is_empty(),
        "hint must not replace a page route"
    );
}
