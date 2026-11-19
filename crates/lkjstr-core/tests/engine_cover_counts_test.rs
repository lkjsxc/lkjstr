#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
        query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const R: &str = "wss://count-deadline.test/";
fn reqs(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => {
                let v: Value = serde_json::from_str(&s).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn missing_feed_eose_releases_counts_at_deadline_in_backoff_and_during_retry() {
    for focused in [false, true] {
        for arrival in [100, 5001, 6000] {
            let mut n = Network::default();
            let mut store = Store::new(100);
            let note = event(1, 1, "visible note", vec![]);
            let q = Query::default();
            let feed_filter = query::filter(&store, &q);
            let feed = ("feed".into(), feed_filter.clone(), q.clone());
            let counts = NostrFilter {
                kinds: Some(vec![1, 6, 7, 9735]),
                tags: [("e".into(), vec![note.id.clone()])].into(),
                limit: Some(200),
                ..Default::default()
            };
            n.configure(vec![R.into()], 0);
            n.focused_sub = focused.then(|| "feed".into());
            n.plan(vec![feed.clone()], &store, 0);
            n.connected(R, 0);
            let first = reqs(&mut n).remove(0);
            assert_eq!(first[2]["kinds"], json!([1, 6]));
            let received = n
                .message(R, &json!(["EVENT", first[1], note]).to_string(), 25)
                .expect("visible note");
            n.event(R, &received, 25);
            store.insert(received, Some(R));
            let wants = vec![feed, ("feed".into(), counts.clone(), q)];
            if arrival == 100 {
                n.plan(wants.clone(), &store, arrival);
            }
            n.tick(4999);
            assert!(reqs(&mut n).is_empty(), "wait for the initial page");
            n.tick(5000);
            let mut frames = reqs(&mut n);
            if arrival > 100 {
                assert!(frames.is_empty());
                n.plan(wants, &store, arrival);
                frames.extend(reqs(&mut n));
                n.tick(arrival + 100);
                frames.extend(reqs(&mut n));
            }
            let count_req = frames
                .iter()
                .find(|f| f[2]["#e"].is_array())
                .expect("counts must run after the initial page deadline");
            if arrival == 6000 {
                assert!(
                    frames
                        .iter()
                        .any(|f| { f[2]["kinds"] == first[2]["kinds"] && f[1] != first[1] }),
                    "exercise a retry before count hydration"
                );
            }
            assert!(!n.page_exhausted(&feed_filter));
            assert!(!n.count_complete(&counts, &store));
            let reaction = event(2, 7, "+", vec![vec!["e".into(), note.id.clone()]]);
            let now = arrival.max(5000) + 101;
            let received = n
                .message(
                    R,
                    &json!(["EVENT", count_req[1], reaction]).to_string(),
                    now,
                )
                .expect("count hydration accepts reactions");
            n.event(R, &received, now);
            store.insert(received, Some(R));
            n.message(R, &json!(["EOSE", count_req[1]]).to_string(), now + 1);
            assert!(n.count_complete(&counts, &store));
        }
    }
}
#[test]
fn feed_eose_releases_counts_before_the_deadline() {
    let mut n = Network::default();
    let store = Store::new(0);
    let q = Query::default();
    let counts = NostrFilter {
        kinds: Some(vec![1, 6, 7, 9735]),
        tags: [("e".into(), vec!["a".repeat(64)])].into(),
        limit: Some(200),
        ..Default::default()
    };
    n.configure(vec![R.into()], 0);
    n.plan(
        vec![
            ("feed".into(), query::filter(&store, &q), q.clone()),
            ("feed".into(), counts.clone(), q),
        ],
        &store,
        0,
    );
    n.connected(R, 0);
    let first = reqs(&mut n).remove(0);
    n.tick(100);
    assert!(reqs(&mut n).is_empty());
    n.message(R, &json!(["EOSE", first[1]]).to_string(), 101);
    n.tick(102);
    let count_req = reqs(&mut n).remove(0);
    assert!(count_req[2]["#e"].is_array());
    n.message(R, &json!(["EOSE", count_req[1]]).to_string(), 103);
    assert!(n.count_complete(&counts, &store));
}
