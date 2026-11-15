#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const R: &str = "wss://focus.test/";
fn reqs(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => {
                let f: Value = serde_json::from_str(&s).expect("frame");
                (f[0] == "REQ").then_some(f)
            }
            _ => None,
        })
        .collect()
}
#[test]
fn focus_precedes_hydration_and_incomplete_focused_pages_are_not_interrupted() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relay_information(R, r#"{"limitation":{"max_subscriptions":1}}"#);
    n.focused_sub = Some("keyboard".into());
    let main = NostrFilter {
        kinds: Some(vec![1, 6]),
        limit: Some(200),
        ..Default::default()
    };
    let hydration = NostrFilter {
        kinds: Some(vec![0]),
        authors: Some(vec!["a".repeat(64)]),
        ..Default::default()
    };
    let wants = vec![
        ("keyboard".into(), main, Query::default()),
        ("details".into(), hydration, Query::default()),
    ];
    n.plan(wants.clone(), &Store::new(0), 0);
    n.connected(R, 1);
    let first = reqs(&mut n);
    assert_eq!(first.len(), 1);
    assert_eq!(first[0][2]["kinds"], json!([1, 6]));
    n.tick(201);
    assert!(reqs(&mut n).is_empty());
    n.message(R, &json!(["EOSE", first[0][1]]).to_string(), 202);
    n.tick(301);
    assert!(reqs(&mut n).iter().any(|f| f[2]["kinds"] == json!([0])));
    let stats = n.request_stats();
    assert!(
        stats
            .as_array()
            .expect("requests")
            .iter()
            .any(|r| r["purpose"] == "focused")
    );
    n.plan(vec![], &Store::new(0), 401);
    n.tick(1000);
    assert!(reqs(&mut n).is_empty());
    assert_eq!(n.request_stats(), json!([]));
    println!("focus scorecard keyboard_first_position before=2 after=1 post_close_REQs=0");
}
