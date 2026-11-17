#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
        query,
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const R: &str = "wss://filter-identity.test/";

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
fn want(sub: &str, filter: NostrFilter) -> (String, NostrFilter, Query) {
    (sub.into(), filter, Query::default())
}

#[test]
fn reordered_exact_wants_share_one_wire_until_the_final_owner_leaves() {
    let mut network = Network::default();
    let store = Store::new(0);
    network.configure(vec![R.into()], 0);
    let first = NostrFilter {
        ids: Some(vec!["b".repeat(64), "a".repeat(64), "b".repeat(64)]),
        authors: Some(vec!["d".repeat(64), "c".repeat(64), "d".repeat(64)]),
        kinds: Some(vec![6, 1, 6]),
        until: Some(200),
        limit: Some(200),
        tags: [
            (
                "e".into(),
                vec!["f".repeat(64), "e".repeat(64), "f".repeat(64)],
            ),
            (
                "p".into(),
                vec!["2".repeat(64), "1".repeat(64), "2".repeat(64)],
            ),
        ]
        .into(),
        ..Default::default()
    };
    let second = NostrFilter {
        ids: Some(vec!["a".repeat(64), "b".repeat(64)]),
        authors: Some(vec!["c".repeat(64), "d".repeat(64)]),
        kinds: Some(vec![1, 6]),
        tags: [
            ("e".into(), vec!["e".repeat(64), "f".repeat(64)]),
            ("p".into(), vec!["1".repeat(64), "2".repeat(64)]),
        ]
        .into(),
        ..first.clone()
    };
    network.plan(
        vec![want("left", first.clone()), want("right", second.clone())],
        &store,
        0,
    );
    network.connected(R, 75);
    let sent = frames(&mut network);
    assert_eq!(sent.len(), 1);
    assert_eq!(
        sent[0].as_array().expect("REQ").len(),
        3,
        "one exact wire filter"
    );
    assert_eq!(
        network.request_stats().as_array().expect("requests").len(),
        1
    );
    assert_eq!(sent[0][2]["ids"], json!(second.ids));
    assert_eq!(sent[0][2]["authors"], json!(second.authors));
    assert_eq!(sent[0][2]["kinds"], json!([1, 6]));
    assert_eq!(sent[0][2]["#e"], json!(second.tags["e"]));
    assert_eq!(sent[0][2]["#p"], json!(second.tags["p"]));

    network.plan(vec![want("right", second.clone())], &store, 101);
    assert!(
        frames(&mut network).is_empty(),
        "closing one owner keeps the wire"
    );
    network.plan(
        vec![want("right", first.clone()), want("left", second.clone())],
        &store,
        102,
    );
    assert!(
        frames(&mut network).is_empty(),
        "reopening/reordering does not replay"
    );
    network.plan(vec![want("left", first)], &store, 103);
    assert!(frames(&mut network).is_empty());
    network.plan(vec![], &store, 104);
    let closed = frames(&mut network);
    assert_eq!(closed, vec![json!(["CLOSE", sent[0][1]])]);
    assert_eq!(network.request_stats(), json!([]));
}

#[test]
fn exact_sharing_keeps_limits_bounds_search_and_empty_predicates_distinct() {
    let mut network = Network::default();
    let store = Store::new(0);
    network.configure(vec![R.into()], 0);
    let base = NostrFilter {
        kinds: Some(vec![1]),
        until: Some(200),
        limit: Some(7),
        search: Some("same".into()),
        ..Default::default()
    };
    let mut variants = vec![base.clone()];
    for field in [
        "ids", "authors", "kinds", "tag", "since", "until", "limit", "search",
    ] {
        let mut changed = base.clone();
        match field {
            "ids" => changed.ids = Some(vec![]),
            "authors" => changed.authors = Some(vec![]),
            "kinds" => changed.kinds = Some(vec![]),
            "tag" => {
                changed.tags.insert("e".into(), vec![]);
            }
            "since" => changed.since = Some(0),
            "until" => changed.until = Some(201),
            "limit" => changed.limit = Some(8),
            _ => changed.search = Some("same ".into()),
        }
        variants.push(changed);
    }
    network.plan(
        variants
            .iter()
            .enumerate()
            .map(|(index, filter)| want(&index.to_string(), filter.clone()))
            .collect(),
        &store,
        0,
    );
    assert_eq!(
        network.request_stats().as_array().expect("requests").len(),
        variants.len()
    );
}

#[test]
fn canonical_notification_identity_preserves_focused_classification() {
    let mut network = Network::default();
    let store = Store::new(0);
    network.configure(vec![R.into()], 0);
    network.focused_sub = Some("news".into());
    let q = Query {
        source: Source::Notifications,
        account: Some("a".repeat(64)),
        ..Default::default()
    };
    let original = query::filter(&store, &q);
    let mut reordered = original.clone();
    reordered.kinds = Some(vec![9735, 7, 16, 6, 42, 1, 7]);
    reordered
        .tags
        .get_mut("p")
        .expect("account selector")
        .push("a".repeat(64));
    network.plan(vec![("news".into(), reordered, q.clone())], &store, 0);
    network.connected(R, 75);
    assert_eq!(frames(&mut network).len(), 1);
    let stats = network.request_stats();
    let requests = stats.as_array().expect("requests");
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0]["purpose"], "focused");
    assert_eq!(requests[0]["priority"], 0);
    assert_eq!(
        query::filter(&store, &q),
        original,
        "public query representation stays stable"
    );
}
