#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query},
};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};

fn setup(slots: usize, limit: usize) -> Engine {
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], 0);
    e.network.relay_information(
        RELAY,
        &json!({"limitation":{"max_subscriptions":slots,"max_limit":limit}}).to_string(),
    );
    e.discover_account(Some(event(1, 1, "", vec![]).pubkey), vec![], 0);
    e.network.connected(RELAY, 1);
    e
}
fn req(e: &mut Engine) -> Value {
    let requests: Vec<_> = frames(e).into_iter().filter(|f| f[0] == "REQ").collect();
    assert_eq!(requests.len(), 1);
    requests[0].clone()
}
fn eose(e: &mut Engine, request: &Value, now: u64) {
    e.network
        .message(RELAY, &json!(["EOSE", request[1]]).to_string(), now);
}

#[test]
fn settled_discovery_yields_to_feed_and_resumes_after_close() {
    let mut e = setup(1, 1);
    let discovery = req(&mut e);
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        101,
    );
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
    eose(&mut e, &discovery, 102);
    e.network.tick(201);
    let batch = frames(&mut e);
    assert!(batch.iter().any(|f| *f == json!(["CLOSE", discovery[1]])));
    assert!(
        batch
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["kinds"] == json!([1, 6]))
    );
    // The feed gets its first page; unfinished own records then get a turn.
    let feed = batch.iter().find(|f| f[0] == "REQ").expect("feed");
    eose(&mut e, feed, 202);
    e.network.tick(301);
    let resumed = req(&mut e);
    e.input(Input::Close { sub: "feed".into() }, 401);
    assert_eq!(resumed[2]["authors"], discovery[2]["authors"]);
    assert_eq!(resumed[2]["limit"], 1);
}

#[test]
fn every_list_is_discovered_with_one_slot_and_one_result_without_views() {
    for limit in [1, 2] {
        let mut e = setup(1, limit);
        frames(&mut e);
        let key = generate_secret_key();
        let lists = [0, 3, 10000, 10002, 10063].map(|kind| {
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: 20000 - kind,
                    kind,
                    content: String::new(),
                    tags: vec![],
                },
                &key,
            )
            .expect("list")
        });
        e.discover_account(Some(lists[0].pubkey.clone()), vec![], 101);
        let mut found = std::collections::BTreeSet::new();
        for now in [201, 401, 601, 801, 1001] {
            e.network.tick(now);
            let request = req(&mut e);
            let kinds = request[2]["kinds"].as_array().expect("kinds");
            assert_eq!(kinds.len(), 1);
            assert_eq!(request[2]["limit"], 1);
            let kind = kinds[0].as_u64().expect("kind");
            assert!(found.insert(kind));
            let list = lists.iter().find(|e| e.kind == kind).expect("list");
            let received = e
                .network
                .message(
                    RELAY,
                    &json!(["EVENT", request[1], list]).to_string(),
                    now + 1,
                )
                .expect("accepted");
            e.network.event(RELAY, &received, now + 1);
            e.store.insert(received, None);
            eose(&mut e, &request, now + 2);
        }
        for list in &lists {
            assert_eq!(
                e.store
                    .replaceable(&list.pubkey, list.kind)
                    .expect("stored")
                    .id,
                list.id
            );
        }
        // Independent reconnect cursors cannot skip the older list kinds.
        e.network.relays.get_mut(RELAY).expect("relay").max_reqs = 5;
        e.network.disconnected(RELAY, 1200);
        e.network.connected(RELAY, 1301);
        let mut replay = Vec::new();
        for now in [1301, 1401, 1501, 1601, 1701] {
            e.network.tick(now);
            replay.extend(frames(&mut e).into_iter().filter(|f| f[0] == "REQ"));
        }
        assert_eq!(replay.len(), 5);
        for request in replay {
            let kind = request[2]["kinds"][0].as_u64().expect("kind");
            let list = lists.iter().find(|e| e.kind == kind).expect("list");
            assert_eq!(request[2]["since"], list.created_at - 2);
        }
    }
}

#[test]
fn settled_discovery_resumes_without_cycling_after_feed_releases_slot() {
    let mut e = setup(1, 1);
    let mut ids = std::collections::BTreeSet::new();
    for now in [101, 301, 501, 701, 901] {
        let request = req(&mut e);
        ids.insert(request[1].clone().to_string());
        eose(&mut e, &request, now);
        if now < 901 {
            e.network.tick(now + 100);
        }
    }
    e.network.tick(1001);
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        1101,
    );
    let feed = req(&mut e);
    assert_eq!(feed[2]["kinds"], json!([1, 6]));
    e.input(Input::Close { sub: "feed".into() }, 1201);
    let resumed = req(&mut e);
    assert!(ids.contains(&resumed[1].to_string()));
    eose(&mut e, &resumed, 1202);
    e.network.tick(1301);
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
}
