#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, frames};
use lkjstr_core::engine::{Engine, protocol::Input};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn records(at: u64) -> Vec<NostrEvent> {
    let key = generate_secret_key();
    [0, 3, 10000, 10002, 10063]
        .into_iter()
        .map(|kind| {
            finalize_event(
                &EventTemplate {
                    pubkey: None,
                    created_at: at,
                    kind,
                    tags: vec![],
                    content: String::new(),
                },
                &key,
            )
            .expect("record")
        })
        .collect()
}
fn requests(e: &mut Engine) -> Vec<Value> {
    frames(e).into_iter().filter(|f| f[0] == "REQ").collect()
}
fn finish(e: &mut Engine, req: &Value, event: &NostrEvent, now: u64) {
    let received = e
        .network
        .message(RELAY, &json!(["EVENT", req[1], event]).to_string(), now)
        .expect("matching request");
    e.network.event(RELAY, &received, now);
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), now + 1);
}

#[test]
fn every_cached_device_owner_refreshes_each_kind_on_a_single_slot() {
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], 0);
    e.network.relay_information(
        RELAY,
        &json!({"limitation":{"max_subscriptions":1,"max_limit":1}}).to_string(),
    );
    let events: Vec<_> = records(10).into_iter().chain(records(20)).collect();
    let accounts: Vec<_> = events.iter().map(|e| e.pubkey.clone()).collect();
    for event in &events {
        e.store.insert(event.clone(), Some("cache"));
    }
    e.discover_accounts(accounts, vec![], 0);
    e.network.connected(RELAY, 1);
    let mut fetched = BTreeSet::new();
    for index in 0..10 {
        let now = index * 200 + 1;
        e.network.tick(now);
        let batch = requests(&mut e);
        assert_eq!(batch.len(), 1);
        let req = &batch[0];
        assert_eq!(req[2]["limit"], 1);
        assert_eq!(req[2]["authors"].as_array().expect("authors").len(), 1);
        assert!(req[2]["since"].is_null());
        let event = events
            .iter()
            .find(|event| req[2]["authors"][0] == event.pubkey && req[2]["kinds"][0] == event.kind)
            .expect("owner kind");
        assert!(fetched.insert((event.pubkey.clone(), event.kind)));
        finish(&mut e, req, event, now + 1);
    }
    assert_eq!(fetched.len(), 10);
    // Explicit sign-in drops the old cursor and fetches all five records again.
    e.refresh_account(&events[0].pubkey, 2101);
    for index in 0..5 {
        let now = 2101 + index * 200;
        e.network.tick(now);
        let batch = requests(&mut e);
        assert_eq!(batch.len(), 1);
        let req = &batch[0];
        assert!(req[2]["since"].is_null());
        assert_eq!(req[2]["authors"][0], events[0].pubkey);
        let event = events
            .iter()
            .find(|event| req[2]["kinds"][0] == event.kind)
            .expect("refreshed kind");
        finish(&mut e, req, event, now + 1);
    }
}

#[test]
fn device_owner_removal_and_page_hiding_release_freshness_requests() {
    let mut e = Engine::new();
    e.network.configure(vec![RELAY.into()], 0);
    let account = records(10)[0].pubkey.clone();
    e.discover_accounts(vec![account.clone()], vec![], 0);
    e.network.connected(RELAY, 1);
    assert_eq!(requests(&mut e).len(), 1);
    e.discover_accounts(vec![], vec![], 101);
    assert!(frames(&mut e).iter().any(|f| f[0] == "CLOSE"));
    e.discover_accounts(vec![account], vec![], 201);
    e.network.connected(RELAY, 201);
    assert_eq!(requests(&mut e).len(), 1);
    e.input(
        Input::Hint {
            visible_subs: vec![],
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        301,
    );
    assert!(frames(&mut e).iter().any(|f| f[0] == "CLOSE"));
    e.network.tick(401);
    assert!(requests(&mut e).is_empty());
}
