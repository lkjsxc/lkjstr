#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, output};
use lkjstr_core::engine::{Engine, protocol, wire};
use lkjstr_protocol::{
    EventTemplate, SecretKeyBytes, UnsignedNostrEvent, finalize_event, generate_secret_key,
};
use serde_json::json;
#[test]
fn create_bound_includes_reserved_signatures_and_jobs_waiting_for_delivery() {
    let key = generate_secret_key();
    let list = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 0,
            kind: 10005,
            tags: vec![],
            content: String::new(),
        },
        &key,
    )
    .expect("list");
    let owner = list.pubkey.clone();
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    e.store.insert(list, None);
    e.input(
        protocol::Input::Configure {
            relays: vec![RELAY.into()],
        },
        1000,
    );
    // Each complete create has two signatures and remains pending on delivery.
    for i in 0..32 {
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":format!("active-{i}"),"action":{"a":"channel.save","as":owner,"channel":{"name":format!("room {i}"),"about":""}}}),
            1000,
        );
        sign_requests(&mut s, &mut e, &key);
    }
    // Another 32 unsigned creates reserve the rest of the 64-job budget.
    for i in 0..32 {
        accept(
            &mut s,
            &mut e,
            json!({"t":"act","req":format!("reserved-{i}"),"action":{"a":"channel.save","as":owner,"channel":{"name":format!("new room {i}"),"about":""}}}),
            1000,
        );
        assert!(output(&mut s, &mut e).iter().any(|m| m["t"] == "sign"));
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"over-bound","action":{"a":"channel.save","as":owner,"channel":{"name":"overflow","about":""}}}),
        1000,
    );
    let out = output(&mut s, &mut e);
    assert!(
        out.iter()
            .any(|m| m["req"] == "over-bound" && m["error"]["code"] == "too-large")
    );
}
fn sign_requests(s: &mut wire::Session, e: &mut Engine, key: &SecretKeyBytes) {
    for _ in 0..3 {
        let signs = output(s, e)
            .into_iter()
            .filter(|m| m["t"] == "sign")
            .collect::<Vec<_>>();
        if signs.is_empty() {
            return;
        }
        for request in signs {
            let unsigned: UnsignedNostrEvent =
                serde_json::from_str(request["event"].as_str().expect("event")).expect("unsigned");
            let signed = finalize_event(
                &EventTemplate {
                    pubkey: Some(unsigned.pubkey),
                    created_at: unsigned.created_at,
                    kind: unsigned.kind,
                    tags: unsigned.tags,
                    content: unsigned.content,
                },
                key,
            )
            .expect("signature");
            accept(
                s,
                e,
                json!({"t":"signed","req":request["req"],"event":serde_json::to_string(&signed).expect("json")}),
                1000,
            );
        }
    }
}

#[test]
fn create_accepts_different_relays_per_stage_and_keeps_background_delivery_identity() {
    let key = generate_secret_key();
    let list = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 0,
            kind: 10005,
            tags: vec![],
            content: String::new(),
        },
        &key,
    )
    .expect("list");
    let owner = list.pubkey.clone();
    let mut e = Engine::new();
    let mut s = wire::Session::default();
    let second = "wss://second.test/";
    e.store.insert(list, None);
    e.network.configure(vec![RELAY.into(), second.into()], 0);
    e.network.connected(RELAY, 1);
    e.network.connected(second, 1);
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"create","action":{"a":"channel.save","as":owner,"channel":{"name":"room","about":""}}}),
        1000,
    );
    sign_requests(&mut s, &mut e, &key);
    // Publication wants reconnect transports that had no read work.
    e.network.connected(RELAY, 1001);
    e.network.connected(second, 1001);
    let frames = engine_review_support::frames(&mut e);
    let id = |kind| {
        frames
            .iter()
            .find(|f| f[0] == "EVENT" && f[1]["kind"] == kind)
            .expect("published stage")[1]["id"]
            .clone()
    };
    let creation = id(40);
    let joined = id(10005);
    e.network
        .message(RELAY, &json!(["OK", creation, true, ""]).to_string(), 1002);
    assert!(!output(&mut s, &mut e).iter().any(|m| m["t"] == "result"));
    e.network
        .message(second, &json!(["OK", joined, true, ""]).to_string(), 1003);
    let messages = output(&mut s, &mut e);
    let result = messages
        .iter()
        .find(|m| m["t"] == "result")
        .expect("create result");
    assert_eq!(result["req"], "create");
    assert_eq!(result["ok"], true);
    assert_eq!(result["id"], creation);
    e.network
        .message(second, &json!(["OK", creation, true, ""]).to_string(), 1004);
    let messages = output(&mut s, &mut e);
    assert!(
        messages
            .iter()
            .any(|m| m["t"] == "delivery" && m["req"] == "create")
    );
    assert!(!messages.iter().any(|m| m["t"] == "result"));
    e.network.tick(31000);
    let messages = output(&mut s, &mut e);
    assert!(
        messages
            .iter()
            .any(|m| m["t"] == "delivery" && m["req"] == "create")
    );
    assert!(
        !messages
            .iter()
            .any(|m| m["req"].as_str().is_some_and(|r| r.contains('~')))
    );
    assert!(!messages.iter().any(|m| m["t"] == "result"));
}
