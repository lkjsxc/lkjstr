#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::Query,
        query,
    },
    store::Store,
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
const R: &str = "wss://cache-gap.test/";
fn note(at: u64, content: &str) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: content.into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("note")
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
fn cached_head_repairs_both_sides_inclusively_without_claiming_exhaustion() {
    let mut store = Store::new(100);
    let cached = note(100, "cached");
    store.insert(cached, Some("cache"));
    let q = Query::default();
    let filter = query::filter(&store, &q);
    let mut network = Network::default();
    network.configure(vec![R.into()], 200_000);
    network.plan(
        vec![("feed".into(), filter.clone(), q.clone())],
        &store,
        200_000,
    );
    network.connected(R, 200_010);
    let initial = frames(&mut network);
    let head = initial
        .iter()
        .find(|f| f[0] == "REQ" && f[2]["since"] == 98)
        .expect("since gap");
    let tie = note(100, "same timestamp, distinct id");
    let received = network
        .message(R, &json!(["EVENT", head[1], tie]).to_string(), 200_020)
        .expect("inclusive tie");
    network.event(R, &received, 200_021);
    store.insert(received, Some(R));
    network.message(R, &json!(["EOSE", head[1]]).to_string(), 200_025);
    network.tick(200_110);
    let older = frames(&mut network);
    assert!(
        older
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["until"] == 100 && f[2]["since"].is_null())
    );
    assert!(
        !network.page_exhausted(&filter),
        "cache membership does not prove historical absence"
    );
    assert_eq!(network.page_cursor(&filter), Some(100));
    assert_eq!(
        store
            .feed(&lkjstr_core::store::Query {
                kinds: vec![1],
                limit: 100,
                ..Default::default()
            })
            .len(),
        2
    );
}
#[test]
fn restart_recomputes_a_safe_boundary_and_failure_cannot_advance_it() {
    let mut store = Store::new(100);
    store.insert(note(90, "older"), Some("cache"));
    store.insert(note(100, "newest"), Some("cache"));
    store.insert(note(999, "future"), Some("cache"));
    for _restart in 0..2 {
        let mut network = Network::default();
        network.configure(vec![R.into()], 200_000);
        let q = Query::default();
        let f = query::filter(&store, &q);
        network.plan(vec![("feed".into(), f.clone(), q)], &store, 200_000);
        network.connected(R, 200_010);
        let sent = frames(&mut network);
        let head = sent
            .iter()
            .find(|f| f[0] == "REQ" && f[2]["since"] == 98)
            .expect("safe watermark");
        network.message(
            R,
            &json!(["CLOSED", head[1], "blocked"]).to_string(),
            200_020,
        );
        network.tick(205_000);
        assert_eq!(network.page_cursor(&f), None);
        assert!(!network.page_exhausted(&f));
    }
}
