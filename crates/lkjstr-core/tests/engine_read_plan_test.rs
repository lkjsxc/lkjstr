#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{
            Effect, Network,
            read_plan::{Candidate, select, weight},
        },
        protocol::Query,
    },
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
use std::collections::BTreeSet;

fn candidate(url: &str, quality: u64, authors: &[&str]) -> Candidate {
    Candidate {
        url: url.into(),
        weight: quality,
        authors: authors.iter().map(|a| (*a).into()).collect(),
    }
}
#[test]
fn coverage_latency_duplicates_and_backoff_affect_routes() {
    let a = candidate("a", 400, &["alice"]);
    let b = candidate("b", 600, &["alice", "bob"]);
    let c = candidate("c", 600, &["bob", "carol"]);
    assert_eq!(select(&[a.clone(), b.clone(), c.clone()], 2), ["b", "c"]);
    assert_eq!(select(&[c, a, b], 2), ["b", "c"]);
    assert!(
        weight(10, 10, Some(100), 0, false, false) > weight(10, 100, Some(100), 0, false, false)
    );
    assert!(
        weight(10, 10, Some(100), 0, false, false) > weight(10, 10, Some(900), 0, false, false)
    );
    assert_eq!(weight(10, 10, None, 0, true, false), 0);
    assert!(weight(10, 10, None, 0, false, true) < weight(10, 10, None, 0, false, false));
    // Retaining a sole cooling route permits the existing retry clock to recover.
    assert_eq!(select(&[candidate("a", 0, &[])], 2), ["a"]);
}
#[test]
fn live_network_uses_verified_lists_without_changing_filters_or_read_scope() {
    let mut network = Network::default();
    network.configure((0..4).map(|i| format!("wss://r{i}.test/")).collect(), 0);
    let author = "a".repeat(64);
    let mut store = Store::new(20);
    store.insert(
        NostrEvent {
            id: "1".repeat(64),
            pubkey: author.clone(),
            created_at: 1,
            kind: 10002,
            tags: vec![
                vec!["r".into(), "wss://r2.test/".into(), "write".into()],
                vec!["r".into(), "wss://r3.test/".into(), "write".into()],
            ],
            content: String::new(),
            sig: "0".repeat(128),
        },
        None,
    );
    // Simulate a transport temporarily present for publication; it is not a read route.
    network
        .relays
        .insert("wss://transient.test/".into(), Default::default());
    let filter = NostrFilter {
        authors: Some(vec![author]),
        kinds: Some(vec![1]),
        until: Some(50),
        ..Default::default()
    };
    network.plan(
        vec![("feed".into(), filter.clone(), Query::default())],
        &store,
        0,
    );
    let connections: BTreeSet<_> = network
        .drain_effects()
        .into_iter()
        .filter_map(|e| {
            if let Effect::Connect(u) = e {
                Some(u)
            } else {
                None
            }
        })
        .collect();
    assert_eq!(
        connections,
        BTreeSet::from(["wss://r2.test/".into(), "wss://r3.test/".into()])
    );
    for relay in &connections {
        network.connected(relay, 1);
    }
    let frames: Vec<serde_json::Value> = network
        .drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .filter(|f: &serde_json::Value| f[0] == "REQ")
        .collect();
    assert_eq!(frames.len(), 2);
    for frame in &frames {
        assert_eq!(frame[2]["authors"], serde_json::json!(filter.authors));
        assert_eq!(frame[2]["until"], 50);
    }
    // Exact-filter page completion remains shared by the original unsplit filter.
    for (relay, frame) in connections.iter().zip(frames) {
        network.message(relay, &serde_json::json!(["EOSE", frame[1]]).to_string(), 5);
    }
    assert!(network.page_finished(&filter));
    network.plan(vec![], &store, 6);
    assert!(
        network
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Disconnect(_)))
    );
}
