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
const R: &str = "wss://batch.test/";
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => Some(serde_json::from_str(&s).expect("frame")),
            _ => None,
        })
        .collect()
}
#[test]
fn one_envelope_keeps_independent_limits_matches_and_union_completion() {
    for max_filters in [1, 4] {
        let mut n = Network::default();
        n.configure(vec![R.into()], 0);
        n.relay_information(
            R,
            &json!({"limitation":{"max_filters":max_filters,"max_subscriptions":1,"max_limit":1}})
                .to_string(),
        );
        let events: Vec<_> = (0..4).map(|i| event(i, 40, "{}", vec![])).collect();
        let wants: Vec<_> = events
            .iter()
            .enumerate()
            .map(|(i, e)| {
                (
                    format!("sub{i}"),
                    NostrFilter {
                        ids: Some(vec![e.id.clone()]),
                        kinds: Some(vec![40]),
                        limit: Some(10),
                        ..Default::default()
                    },
                    Query::default(),
                )
            })
            .collect();
        n.plan(wants, &Store::new(0), 0);
        n.connected(R, 1);
        let mut count = 0;
        for at in 0..4 {
            n.tick(at * 200 + 1);
            for f in frames(&mut n).into_iter().filter(|f| f[0] == "REQ") {
                count += 1;
                assert!(f.as_array().expect("array").len() <= max_filters as usize + 2);
                for filter in f.as_array().expect("array").iter().skip(2) {
                    assert_eq!(filter["limit"], 1);
                    let e = events
                        .iter()
                        .find(|e| filter["ids"][0] == e.id)
                        .expect("matching id");
                    assert!(
                        n.message(R, &json!(["EVENT", f[1], e]).to_string(), at * 200 + 2)
                            .is_some()
                    );
                }
                let unrelated = event(100, 40, "{}", vec![]);
                assert!(
                    n.message(
                        R,
                        &json!(["EVENT", f[1], unrelated]).to_string(),
                        at * 200 + 2
                    )
                    .is_none()
                );
                n.message(R, &json!(["EOSE", f[1]]).to_string(), at * 200 + 3);
            }
        }
        assert_eq!(count, if max_filters == 1 { 4 } else { 1 });
        assert!(events.iter().all(|e| n.lookup_complete(&e.id)));
        assert!(n.open_wires().is_empty());
    }
    println!(
        "batch scorecard logical_filters=4 recall=4/4 connections=1 before_REQs=4 after_REQs=1"
    );
}
#[test]
fn cancelling_one_finite_member_keeps_the_other_without_replaying_its_answer() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relay_information(R, r#"{"limitation":{"max_filters":4}}"#);
    let wants: Vec<_> = (0..2)
        .map(|i| {
            (
                format!("sub{i}"),
                NostrFilter {
                    ids: Some(vec![format!("{i:064x}")]),
                    kinds: Some(vec![40]),
                    ..Default::default()
                },
                Query::default(),
            )
        })
        .collect();
    n.plan(wants.clone(), &Store::new(0), 0);
    n.connected(R, 1);
    let initial = frames(&mut n);
    assert_eq!(initial.iter().filter(|f| f[0] == "REQ").count(), 1);
    n.plan(vec![wants[0].clone()], &Store::new(0), 201);
    let changed = frames(&mut n);
    assert!(
        changed.is_empty(),
        "the surviving finite filter needs no replay"
    );
    let old = initial
        .iter()
        .find(|f| f[0] == "REQ")
        .expect("initial envelope");
    assert!(!n.lookup_complete(&format!("{:064x}", 0)));
    n.message(R, &json!(["EOSE", old[1]]).to_string(), 202);
    assert!(n.lookup_complete(&format!("{:064x}", 0)));
    assert!(!n.lookup_complete(&format!("{:064x}", 1)));
}
