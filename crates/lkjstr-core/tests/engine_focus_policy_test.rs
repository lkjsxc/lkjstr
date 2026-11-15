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
        limit: Some(1),
        ..Default::default()
    };
    let wants = vec![
        ("keyboard".into(), main, Query::default()),
        ("details".into(), hydration, Query::default()),
    ];
    n.plan(wants.clone(), &Store::new(0), 0);
    n.connected(R, 75);
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

#[test]
fn completed_focus_waits_for_delayed_hydration_then_resumes() {
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
        limit: Some(1),
        ..Default::default()
    };
    let wants = vec![
        ("keyboard".into(), main.clone(), Query::default()),
        ("details".into(), hydration.clone(), Query::default()),
    ];
    let store = Store::new(0);
    n.plan(wants.clone(), &store, 0);
    n.connected(R, 75);
    let head = reqs(&mut n).remove(0);
    n.message(R, &json!(["EOSE", head[1]]).to_string(), 202);
    n.tick(301);
    let lookup = reqs(&mut n).remove(0);
    assert_eq!(lookup[2]["kinds"], json!([0]));
    // Worker slices and replans must leave the wire alive for slow replies.
    for now in (326..=1301).step_by(25) {
        n.plan(wants.clone(), &store, now);
        assert!(
            n.drain_effects().is_empty(),
            "hydration interrupted at {now}"
        );
    }
    let event = lkjstr_protocol::NostrEvent {
        id: "b".repeat(64),
        pubkey: "a".repeat(64),
        kind: 0,
        created_at: 1,
        tags: vec![],
        content: r#"{"name":"delayed"}"#.into(),
        sig: "0".repeat(128),
    };
    assert!(
        n.message(R, &json!(["EVENT", lookup[1], event]).to_string(), 1310)
            .is_some()
    );
    n.message(R, &json!(["EOSE", lookup[1]]).to_string(), 1311);
    assert!(n.page_finished(&hydration));
    n.tick(1326);
    let resumed = reqs(&mut n);
    assert_eq!(resumed.len(), 1);
    assert_eq!(resumed[0][2], head[2]);
    assert_ne!(resumed[0][1], head[1]);
    assert!(n.page_finished(&main));
}

#[test]
fn unfinished_focus_can_preempt_an_inflight_profile_lookup() {
    let mut n = Network::default();
    n.configure(vec![R.into()], 0);
    n.relay_information(R, r#"{"limitation":{"max_subscriptions":1}}"#);
    let store = Store::new(0);
    let hydration = (
        "details".into(),
        NostrFilter {
            kinds: Some(vec![0]),
            authors: Some(vec!["a".repeat(64)]),
            ..Default::default()
        },
        Query::default(),
    );
    n.plan(vec![hydration.clone()], &store, 0);
    n.connected(R, 75);
    assert_eq!(reqs(&mut n)[0][2]["kinds"], json!([0]));
    n.focused_sub = Some("keyboard".into());
    n.plan(
        vec![
            hydration,
            (
                "keyboard".into(),
                NostrFilter {
                    kinds: Some(vec![1, 6]),
                    limit: Some(200),
                    ..Default::default()
                },
                Query::default(),
            ),
        ],
        &store,
        201,
    );
    let focused = reqs(&mut n);
    assert_eq!(focused.len(), 1);
    assert_eq!(focused[0][2]["kinds"], json!([1, 6]));
    n.tick(226);
    assert!(reqs(&mut n).is_empty());
}
