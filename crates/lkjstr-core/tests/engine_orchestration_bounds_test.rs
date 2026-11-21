#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
        publication_plan::{PublicationInput, plan},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
fn urls(prefix: &str, count: usize) -> Vec<String> {
    (0..count)
        .map(|n| format!("wss://{prefix}-{n}.test/"))
        .collect()
}
fn frames(network: &mut Network) -> Vec<Value> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}
#[test]
fn deletion_has_one_global_delivery_bound_with_explicit_capacity_exclusions() {
    let routes = plan(PublicationInput {
        own: urls("own", 12),
        context: urls("previous", 192),
        deletion: true,
        ..Default::default()
    });
    assert_eq!(routes.len(), 204);
    assert_eq!(routes.iter().filter(|d| d.state == "pending").count(), 192);
    assert_eq!(
        routes
            .iter()
            .filter(|d| d.reason.as_deref() == Some("capacity"))
            .count(),
        12
    );
}
#[test]
fn inbox_lookup_waits_for_first_feed_page_then_rotates_single_slot() {
    let relay = "wss://single.test/";
    let mut network = Network::default();
    let store = Store::new(10);
    network.configure(vec![relay.into()], 0);
    network.relay_information(
        relay,
        &json!({"limitation":{"max_subscriptions":1}}).to_string(),
    );
    let query = Query {
        source: Source::Relay,
        target: Some(relay.into()),
        ..Default::default()
    };
    let feed = (
        "feed".into(),
        NostrFilter {
            kinds: Some(vec![1, 6]),
            limit: Some(20),
            ..Default::default()
        },
        query.clone(),
    );
    let inbox = (
        "~publication:post".into(),
        NostrFilter {
            authors: Some(vec!["a".repeat(64)]),
            kinds: Some(vec![10002]),
            limit: Some(1),
            ..Default::default()
        },
        query,
    );
    network.plan(vec![feed.clone()], &store, 0);
    network.connected(relay, 1);
    let page = frames(&mut network)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("feed");
    network.plan(vec![feed.clone(), inbox], &store, 200);
    assert!(
        !frames(&mut network)
            .iter()
            .any(|f| f[0] == "REQ" || f[0] == "CLOSE")
    );
    network.message(relay, &json!(["EOSE", page[1]]).to_string(), 201);
    network.tick(300);
    let batch = frames(&mut network);
    assert!(batch.iter().any(|f| *f == json!(["CLOSE", page[1]])));
    let lookup = batch
        .iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([10002]))
        .expect("lookup gets a turn");
    network.message(relay, &json!(["EOSE", lookup[1]]).to_string(), 301);
    network.plan(vec![feed], &store, 400);
    let mut resumed = frames(&mut network);
    assert!(resumed.iter().any(|f| *f == json!(["CLOSE", lookup[1]])));
    network.tick(1300);
    resumed.extend(frames(&mut network));
    // A finite list lookup releases its slot immediately after EOSE.
    assert_eq!(
        resumed
            .iter()
            .filter(|f| f[0] == "REQ" && f[2]["kinds"] == json!([1, 6]))
            .count(),
        1
    );
}
