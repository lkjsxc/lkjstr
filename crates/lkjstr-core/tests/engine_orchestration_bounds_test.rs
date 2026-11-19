#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
        publication_plan::{PublicationInput, plan},
    },
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
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
        context: urls("previous", 64),
        deletion: true,
        ..Default::default()
    });
    assert_eq!(routes.len(), 76);
    assert_eq!(routes.iter().filter(|d| d.state == "pending").count(), 64);
    assert_eq!(
        routes
            .iter()
            .filter(|d| d.reason.as_deref() == Some("capacity"))
            .count(),
        12
    );
}
#[test]
fn configured_routes_wait_for_capacity_without_dropping_publications_then_resume() {
    let mut network = Network::default();
    let original = urls("original", 64);
    let event = NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 1,
        kind: 5,
        tags: vec![],
        content: String::new(),
        sig: "0".repeat(128),
    };
    network.publish(
        "delete".into(),
        event.clone(),
        plan(PublicationInput {
            context: original.clone(),
            deletion: true,
            ..Default::default()
        }),
        0,
    );
    let configured = urls("configured", 24);
    network.configure(configured.clone(), 1);
    assert_eq!(network.relays.len(), 64);
    assert_eq!(network.deferred_relays.len(), 24);
    assert!(network.pending_event(&event.id));
    assert!(original.iter().all(|url| network.relays.contains_key(url)));
    assert!(configured.iter().all(|url| network.known.contains_key(url)));
    assert_eq!(network.published_routes(&event.id).len(), 64);
    let mut restored = Network::default();
    restored.restore_publication_routes(&network.publication_routes_json());
    assert_eq!(restored.published_routes(&event.id).len(), 64);
    network.tick(30000);
    network.tick(30001);
    assert_eq!(network.relays.len(), 24);
    assert!(network.deferred_relays.is_empty());
    assert!(
        configured
            .iter()
            .all(|url| network.relays.contains_key(url))
    );
    assert!(!network.pending_event(&event.id));
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
