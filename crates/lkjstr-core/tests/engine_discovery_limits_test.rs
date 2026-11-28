#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{
    Engine,
    protocol::{Input, Query},
};
use lkjstr_protocol::{EventTemplate, finalize_event, parse_secret_key_hex};
use serde_json::{Value, json};
use std::collections::BTreeSet;
// Scheduler milliseconds are later than the fixture's signed event seconds.
const BASE_MS: u64 = 20_100_000;
const KINDS: [u64; 6] = [0, 3, 10000, 10001, 10002, 10063];

fn setup(account: String, slots: usize, limit: usize) -> Engine {
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], BASE_MS);
    e.network.relay_information(
        RELAY,
        &json!({"limitation":{"max_subscriptions":slots,"max_limit":limit}}).to_string(),
    );
    e.discover_account(Some(account), vec![], BASE_MS);
    e.network.connected(RELAY, BASE_MS + 1);
    e
}
fn req(e: &mut Engine) -> Value {
    let requests: Vec<_> = frames(e).into_iter().filter(|f| f[0] == "REQ").collect();
    assert_eq!(requests.len(), 1);
    requests[0].clone()
}
fn eose(e: &mut Engine, request: &Value, now: u64) {
    e.network.message(
        RELAY,
        &json!(["EOSE", request[1]]).to_string(),
        BASE_MS + now,
    );
}
fn notification(e: &Engine, request: &Value) -> bool {
    if request[2]["#p"].is_null() {
        return false;
    }
    assert_eq!(request[2]["#p"], json!(e.discovery_accounts));
    assert_eq!(request[2]["kinds"], json!([1, 6, 7, 16, 42, 9735]));
    true
}
fn discovery_kind(request: &Value) -> u64 {
    assert!(request[2]["#p"].is_null());
    assert_eq!(request[2]["authors"].as_array().expect("owner").len(), 1);
    let kinds = request[2]["kinds"].as_array().expect("kinds");
    assert_eq!(kinds.len(), 1);
    assert_eq!(request[2]["limit"], 1);
    let kind = kinds[0].as_u64().expect("kind");
    assert!(KINDS.contains(&kind));
    kind
}

#[test]
fn settled_discovery_yields_to_feed_and_resumes_after_close() {
    let mut e = setup(event(1, 1, "", vec![]).pubkey, 1, 1);
    let watch = req(&mut e);
    assert!(notification(&e, &watch));
    eose(&mut e, &watch, 2);
    e.network.tick(BASE_MS + 101);
    let discovery = req(&mut e);
    discovery_kind(&discovery);
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        BASE_MS + 201,
    );
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
    eose(&mut e, &discovery, 202);
    e.network.tick(BASE_MS + 301);
    let batch = frames(&mut e);
    assert!(batch.iter().any(|f| *f == json!(["CLOSE", discovery[1]])));
    let feed = batch.iter().find(|f| f[0] == "REQ").expect("feed");
    assert_eq!(feed[2]["kinds"], json!([1, 6]));
    // The feed gets its first page; unfinished own records then get a turn.
    eose(&mut e, feed, 302);
    e.network.tick(BASE_MS + 401);
    let resumed = req(&mut e);
    discovery_kind(&resumed);
    e.input(Input::Close { sub: "feed".into() }, BASE_MS + 501);
    assert_eq!(resumed[2]["authors"], discovery[2]["authors"]);
    assert_eq!(resumed[2]["limit"], 1);
}

#[test]
fn every_list_is_discovered_with_one_slot_and_one_result_without_views() {
    for limit in [1, 2] {
        let key = parse_secret_key_hex(&"01".repeat(32)).expect("deterministic fixture key");
        let lists = KINDS.map(|kind| {
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
        let mut e = setup(lists[0].pubkey.clone(), 1, limit);
        let mut found = BTreeSet::new();
        let mut notices = 0;
        for now in (1..=601).step_by(100) {
            e.network.tick(BASE_MS + now);
            let request = req(&mut e);
            if notification(&e, &request) {
                notices += 1;
            } else {
                let kind = discovery_kind(&request);
                assert!(found.insert(kind));
                let list = lists.iter().find(|e| e.kind == kind).expect("list");
                let received = e
                    .network
                    .message(
                        RELAY,
                        &json!(["EVENT", request[1], list]).to_string(),
                        BASE_MS + now + 1,
                    )
                    .expect("accepted");
                e.network.event(RELAY, &received, BASE_MS + now + 1);
                e.store.insert(received, None);
            }
            eose(&mut e, &request, now + 2);
        }
        assert_eq!(notices, 1);
        assert_eq!(found, KINDS.into_iter().collect());
        for list in &lists {
            assert_eq!(
                e.store
                    .replaceable(&list.pubkey, list.kind)
                    .expect("stored")
                    .id,
                list.id
            );
        }
        // Seven live heads now exist: six independent records plus notifications.
        e.network.relays.get_mut(RELAY).expect("relay").max_reqs = 7;
        e.network.disconnected(RELAY, BASE_MS + 800);
        e.network.connected(RELAY, BASE_MS + 901);
        let mut replay = Vec::new();
        let mut replay_notices = 0;
        for now in (901..=1901).step_by(100) {
            e.network.tick(BASE_MS + now);
            for request in frames(&mut e).into_iter().filter(|f| f[0] == "REQ") {
                if notification(&e, &request) {
                    replay_notices += 1;
                    eose(&mut e, &request, now + 1);
                } else {
                    replay.push(request);
                }
            }
        }
        assert_eq!(replay_notices, 1);
        assert_eq!(replay.len(), 6);
        let mut replayed_kinds = BTreeSet::new();
        for request in replay {
            let kind = discovery_kind(&request);
            assert!(replayed_kinds.insert(kind));
            let list = lists.iter().find(|e| e.kind == kind).expect("list");
            assert_eq!(request[2]["since"], list.created_at - 2);
        }
        assert_eq!(replayed_kinds, found);
    }
}

#[test]
fn settled_discovery_resumes_without_cycling_after_feed_releases_slot() {
    let mut e = setup(event(1, 1, "", vec![]).pubkey, 1, 1);
    let mut ids = BTreeSet::new();
    let mut settled = BTreeSet::new();
    let mut notices = 0;
    for now in (1..=601).step_by(100) {
        e.network.tick(BASE_MS + now);
        let request = req(&mut e);
        if notification(&e, &request) {
            notices += 1;
        } else {
            ids.insert(request[1].to_string());
            assert!(settled.insert(discovery_kind(&request)));
        }
        eose(&mut e, &request, now + 1);
    }
    assert_eq!(settled, KINDS.into_iter().collect());
    // The notification head may reclaim its live slot once. Settled discovery
    // must not rotate through already answered records to compete with it.
    for now in (701..=2001).step_by(100) {
        e.network.tick(BASE_MS + now);
        for request in frames(&mut e).into_iter().filter(|f| f[0] == "REQ") {
            assert!(
                notification(&e, &request),
                "unexpected discovery cycle: {request}"
            );
            notices += 1;
            eose(&mut e, &request, now + 1);
        }
    }
    assert_eq!(notices, 2);
    e.network.tick(BASE_MS + 2101);
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        BASE_MS + 2201,
    );
    let feed = req(&mut e);
    assert_eq!(feed[2]["kinds"], json!([1, 6]));
    e.input(Input::Close { sub: "feed".into() }, BASE_MS + 2301);
    let resumed = req(&mut e);
    assert!(
        !ids.contains(&resumed[1].to_string()),
        "resumption has a fresh wire id"
    );
    discovery_kind(&resumed);
    eose(&mut e, &resumed, 2302);
    e.network.tick(BASE_MS + 2401);
    assert!(!frames(&mut e).iter().any(|f| f[0] == "REQ"));
    for now in (2501..=4401).step_by(100) {
        e.network.tick(BASE_MS + now);
        for request in frames(&mut e).into_iter().filter(|f| f[0] == "REQ") {
            assert!(
                notification(&e, &request),
                "settled discovery must stay quiet"
            );
            notices += 1;
            eose(&mut e, &request, now + 1);
        }
    }
    assert_eq!(notices, 3);
}
