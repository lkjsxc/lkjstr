#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, event, frames, output};
use lkjstr_core::engine::{Engine, protocol, wire};
use serde_json::{Value, json};

fn setup() -> (Engine, wire::Session, String) {
    let mut engine = Engine::new();
    engine.input(
        protocol::Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    (
        engine,
        wire::Session::default(),
        event(1, 1, "owner", vec![]).pubkey,
    )
}
fn create(s: &mut wire::Session, e: &mut Engine, owner: &str, req: &str) {
    accept(
        s,
        e,
        json!({"t":"act","req":req,"action":{"a":"channel.save","as":owner,"channel":{"name":"early","about":""}}}),
        0,
    );
}
fn lookup(e: &mut Engine) -> Value {
    e.network.connected(RELAY, 1);
    e.tick(100);
    frames(e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([10005]))
        .expect("owner lookup without a view")
}

#[test]
fn early_create_waits_for_verified_absence_then_signs_without_a_view() {
    let (mut e, mut s, owner) = setup();
    create(&mut s, &mut e, &owner, "early");
    assert!(output(&mut s, &mut e).is_empty());
    let request = lookup(&mut e);
    e.network
        .message(RELAY, &json!(["EOSE", request[1]]).to_string(), 101);
    e.tick(200);
    let messages = output(&mut s, &mut e);
    let sign = messages
        .iter()
        .find(|m| m["t"] == "sign")
        .expect("deferred signature");
    assert_eq!(sign["req"], "early");
    let event: Value =
        serde_json::from_str(sign["event"].as_str().expect("unsigned")).expect("json");
    assert_eq!(event["kind"], 40);
}

#[test]
fn early_join_waits_for_existing_list_and_preserves_order_and_opaque_data() {
    let (mut e, mut s, _) = setup();
    let first = "a".repeat(64);
    let second = "b".repeat(64);
    let list = event(
        1,
        10005,
        "opaque",
        vec![
            vec!["e".into(), first.clone()],
            vec!["x".into(), "keep".into()],
        ],
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"act","req":"join","action":{"a":"channel.join","as":list.pubkey,"id":second,"on":true}}),
        0,
    );
    assert!(output(&mut s, &mut e).is_empty());
    let request = lookup(&mut e);
    if let Some(event) =
        e.network
            .message(RELAY, &json!(["EVENT", request[1], list]).to_string(), 101)
    {
        e.enqueue(RELAY.into(), event);
    }
    e.network
        .message(RELAY, &json!(["EOSE", request[1]]).to_string(), 102);
    assert!(output(&mut s, &mut e).iter().all(|m| m["t"] != "sign"));
    e.tick(200);
    let messages = output(&mut s, &mut e);
    let sign = messages
        .iter()
        .find(|m| m["t"] == "sign")
        .expect("join signature");
    let event: Value =
        serde_json::from_str(sign["event"].as_str().expect("unsigned")).expect("json");
    assert_eq!(event["kind"], 10005);
    assert_eq!(event["content"], "opaque");
    assert_eq!(
        event["tags"],
        json!([["e", first], ["x", "keep"], ["e", second]])
    );
}

#[test]
fn refused_or_unanswered_lookup_times_out_without_signing_and_releases_work() {
    for refused in [false, true] {
        let (mut e, mut s, owner) = setup();
        create(&mut s, &mut e, &owner, "timeout");
        let request = lookup(&mut e);
        if refused {
            e.network.message(
                RELAY,
                &json!(["CLOSED", request[1], "error: fixture refusal"]).to_string(),
                101,
            );
        }
        e.tick(20000);
        let messages = output(&mut s, &mut e);
        assert!(messages.iter().all(|m| m["t"] != "sign"));
        assert!(
            messages
                .iter()
                .any(|m| m["req"] == "timeout" && m["ok"] == false)
        );
        assert_eq!(
            e.network
                .request_progress(&format!("~channel-action:{owner}")),
            (0, 0)
        );
    }
}

#[test]
fn pending_channel_edits_are_bounded_and_duplicate_requests_do_not_replace_them() {
    let (mut e, mut s, owner) = setup();
    for n in 0..64 {
        create(&mut s, &mut e, &owner, &format!("pending-{n}"));
    }
    assert!(output(&mut s, &mut e).is_empty());
    create(&mut s, &mut e, &owner, "pending-0");
    create(&mut s, &mut e, &owner, "overflow");
    let messages = output(&mut s, &mut e);
    assert!(
        messages
            .iter()
            .any(|m| m["req"] == "pending-0" && m["ok"] == false)
    );
    assert!(
        messages
            .iter()
            .any(|m| m["req"] == "overflow" && m["error"]["code"] == "too-large")
    );
    e.tick(20000);
    assert_eq!(
        output(&mut s, &mut e)
            .iter()
            .filter(
                |m| m["req"].as_str().is_some_and(|r| r.starts_with("pending-"))
                    && m["ok"] == false
            )
            .count(),
        64
    );
    assert_eq!(
        e.network
            .request_progress(&format!("~channel-action:{owner}")),
        (0, 0)
    );
}
