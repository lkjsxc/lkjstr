#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
use serde_json::{Value, json};
const A: &str = "wss://identity-page-a.test/";
const B: &str = "wss://identity-page-b.test/";
fn frames(network: &mut Network) -> Vec<(String, Value)> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(relay, text) => Some((relay, serde_json::from_str(&text).expect("frame"))),
            _ => None,
        })
        .collect()
}

#[test]
fn reordered_page_identity_keeps_the_unfinished_route_at_its_original_cursor() {
    let mut network = Network::default();
    let store = Store::new(0);
    network.configure(vec![A.into(), B.into()], 0);
    let first = NostrFilter {
        kinds: Some(vec![6, 1]),
        authors: Some(vec!["b".repeat(64), "a".repeat(64)]),
        until: Some(100),
        limit: Some(2),
        ..Default::default()
    };
    network.plan(
        vec![("history".into(), first.clone(), Query::default())],
        &store,
        0,
    );
    network.connected(A, 75);
    network.connected(B, 75);
    let sent = frames(&mut network);
    let a = &sent
        .iter()
        .find(|(relay, frame)| relay == A && frame[0] == "REQ")
        .expect("first route")
        .1;
    let b = &sent
        .iter()
        .find(|(relay, frame)| relay == B && frame[0] == "REQ")
        .expect("unfinished route")
        .1;
    for (index, at) in [100, 99].into_iter().enumerate() {
        let event = NostrEvent {
            id: format!("{:064x}", index + 1),
            pubkey: "a".repeat(64),
            kind: 1,
            created_at: at,
            content: "historical fixture".into(),
            tags: vec![],
            sig: "0".repeat(128),
        };
        assert!(
            network
                .message(A, &json!(["EVENT", a[1], event]).to_string(), 80)
                .is_some()
        );
    }
    network.message(A, &json!(["EOSE", a[1]]).to_string(), 81);
    frames(&mut network);
    let mut reordered = NostrFilter {
        kinds: Some(vec![1, 6, 1]),
        authors: Some(vec!["a".repeat(64), "b".repeat(64), "a".repeat(64)]),
        ..first
    };
    assert_eq!(network.page_cursor(&reordered), Some(99));
    assert!(
        !network.page_finished(&reordered),
        "the second route remains incomplete"
    );
    assert!(!network.page_exhausted(&reordered));
    reordered.until = Some(99);
    network.plan(
        vec![("history".into(), reordered.clone(), Query::default())],
        &store,
        200,
    );
    let advanced = frames(&mut network);
    assert!(
        advanced.iter().all(|(relay, _)| relay != B),
        "unfinished wire must not restart"
    );
    assert!(
        advanced
            .iter()
            .any(|(relay, frame)| relay == A && frame[0] == "REQ" && frame[2]["until"] == 99)
    );
    network.message(B, &json!(["EOSE", b[1]]).to_string(), 201);
    assert!(
        !network.page_exhausted(&reordered),
        "the advancing route is still pending"
    );
}

#[test]
fn completed_empty_page_evidence_accepts_an_equivalent_selector_order() {
    let mut network = Network::default();
    let store = Store::new(0);
    network.configure(vec![A.into()], 0);
    let filter = NostrFilter {
        kinds: Some(vec![6, 1]),
        until: Some(100),
        limit: Some(2),
        ..Default::default()
    };
    network.plan(
        vec![("history".into(), filter.clone(), Query::default())],
        &store,
        0,
    );
    network.connected(A, 75);
    let sent = frames(&mut network);
    let req = &sent
        .iter()
        .find(|(_, frame)| frame[0] == "REQ")
        .expect("request")
        .1;
    network.message(A, &json!(["EOSE", req[1]]).to_string(), 80);
    let equivalent = NostrFilter {
        kinds: Some(vec![1, 6, 1]),
        ..filter
    };
    assert!(network.page_finished(&equivalent));
    assert!(network.page_exhausted(&equivalent));
    assert_eq!(network.page_cursor(&equivalent), None);
}
