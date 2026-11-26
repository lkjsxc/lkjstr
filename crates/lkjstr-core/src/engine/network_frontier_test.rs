#![allow(clippy::expect_used)]
use super::PageFrontier;
use crate::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{EventTemplate, NostrFilter, finalize_event, generate_secret_key};
use serde_json::{Value, json};

#[test]
fn frontier_is_bounded_order_independent_and_duplicate_safe() {
    for observations in [
        vec![("a", 100), ("b", 99), ("c", 1), ("a", 100)],
        vec![("c", 1), ("b", 99), ("a", 100), ("c", 1)],
    ] {
        let mut frontier = PageFrontier::default();
        for (id, at) in observations {
            frontier.record(id, at, 2);
            assert!(frontier.len() <= 2);
        }
        assert_eq!(frontier.oldest, Some(99));
        assert_eq!(
            frontier.iter().map(String::as_str).collect::<Vec<_>>(),
            ["a", "b"]
        );
        // An altered body with the same ID cannot move its recorded timestamp.
        assert_eq!(frontier.record("b", 0, 2), Some(99));
    }
}

#[test]
fn tied_boundary_clones_and_clears_without_losing_quota_evidence() {
    let mut frontier = PageFrontier::default();
    frontier.record("a", 100, 2);
    frontier.record("b", 99, 2);
    assert_eq!(frontier.record("c", 99, 2), Some(99));
    assert_eq!(frontier.len(), 2);
    let mut continuation = frontier.clone();
    assert_eq!(continuation.record("d", 101, 2), Some(100));
    assert_eq!(frontier.oldest, Some(99));
    continuation.clear();
    assert!(continuation.is_empty());
    assert_eq!(continuation.oldest, None);
    assert_eq!(continuation.record("new", 20, 1), Some(20));
    assert_eq!(continuation.record("ignored", 30, 0), None);
    assert!(continuation.is_empty());
}

fn frames(network: &mut Network) -> Vec<Value> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("wire frame")),
            _ => None,
        })
        .collect()
}

#[test]
fn verification_loss_clears_each_frontier_and_replays_the_original_span() {
    const RELAY: &str = "wss://frontier-verification.test/";
    let key = generate_secret_key();
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind: 1,
            content: "frontier verification fixture".into(),
            tags: vec![],
        },
        &key,
    )
    .expect("signed fixture");
    let broad = NostrFilter {
        authors: Some(vec![event.pubkey.clone()]),
        kinds: Some(vec![1, 6]),
        until: Some(200),
        limit: Some(200),
        ..Default::default()
    };
    let narrow = NostrFilter {
        kinds: Some(vec![1]),
        ..broad.clone()
    };
    let mut network = Network::default();
    network.configure(vec![RELAY.into()], 200_000);
    network.relay_information(RELAY, r#"{"limitation":{"max_filters":2,"max_limit":2}}"#);
    network.plan(
        vec![
            ("broad".into(), broad.clone(), Query::default()),
            ("narrow".into(), narrow, Query::default()),
        ],
        &Store::new(0),
        200_000,
    );
    network.connected(RELAY, 200_001);
    let initial = frames(&mut network)
        .into_iter()
        .find(|frame| frame[0] == "REQ")
        .expect("shared request");
    assert_eq!(initial.as_array().expect("envelope").len(), 4);
    network.message(
        RELAY,
        &json!(["EVENT", initial[1], event]).to_string(),
        200_002,
    );
    assert!(
        network
            .requests
            .values()
            .all(|request| { request.received.len() == 1 && request.oldest == Some(100) })
    );
    network.verification_dropped(RELAY, &event);
    assert!(network.requests.values().all(|request| {
        request.received.is_empty()
            && request.oldest.is_none()
            && request.verification_retry
            && !request.page_eose
    }));
    network.message(RELAY, &json!(["EOSE", initial[1]]).to_string(), 200_003);
    assert_eq!(network.page_cursor(&broad), None);
    network.verifying = true;
    network.tick(201_100);
    assert!(!frames(&mut network).iter().any(|frame| frame[0] == "REQ"));
    network.verifying = false;
    network.tick(201_101);
    let retry = frames(&mut network)
        .into_iter()
        .find(|frame| frame[0] == "REQ")
        .expect("retry after verification drains");
    assert_ne!(retry[1], initial[1]);
    assert!(
        retry.as_array().expect("filters")[2..]
            .iter()
            .all(|filter| filter["until"] == 200 && filter["limit"] == 2)
    );
    assert!(
        network
            .requests
            .values()
            .all(|request| { request.received.is_empty() && request.oldest.is_none() })
    );
}

#[test]
fn confirmation_requires_the_admitted_timestamp_and_is_cleared_on_replay() {
    let mut page = PageFrontier::default();
    page.record("first", 11, 2);
    page.record("second", 10, 2);
    page.confirm("first", 11);
    page.confirm("second", 9);
    assert!(!page.verified());
    page.confirm("second", 10);
    assert!(page.verified());
    page.record("newer", 12, 2);
    assert!(!page.verified());
    page.clear();
    page.record("first", 11, 2);
    assert!(!page.verified());
}
