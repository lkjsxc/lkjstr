#![allow(clippy::expect_used)]

mod engine_review_support;
use engine_review_support::{RELAY, accept, frames, output};
use lkjstr_core::engine::{Engine, accounts::Accounts, wire::Session};
use serde_json::{Value, json};

#[test]
fn cancelled_unsigned_post_drops_a_late_valid_signature() {
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("fixture account");
    let owner = accounts.active.clone().expect("active");
    let mut session = Session::default();
    let mut engine = Engine::new();
    accept(
        &mut session,
        &mut engine,
        json!({"t":"act","req":"post","action":{"a":"publish","as":owner,"what":{"k":"note","draft":{"text":"cancelled fixture"}}}}),
        1000,
    );
    let initial = output(&mut session, &mut engine);
    let sign = initial.iter().find(|f| f["t"] == "sign").expect("sign");
    let unsigned = serde_json::from_str(sign["event"].as_str().expect("event")).expect("unsigned");
    let event = accounts.sign(&unsigned).expect("sign").expect("signature");
    let id = event.id.clone();
    accept(
        &mut session,
        &mut engine,
        json!({"t":"signed","req":"post","error":"cancelled"}),
        2000,
    );
    let cancelled = output(&mut session, &mut engine);
    assert!(
        cancelled
            .iter()
            .any(|f| f["t"] == "result" && f["req"] == "post" && f["error"]["code"] == "cancelled")
    );
    accept(
        &mut session,
        &mut engine,
        json!({"t":"signed","req":"post","event":serde_json::to_string(&event).expect("event")}),
        21000,
    );
    engine.network.connected(RELAY, 21001);
    let late = output(&mut session, &mut engine);
    assert!(!late.iter().any(|f| f["t"] == "publish.signed"));
    assert!(!frames(&mut engine).iter().any(|f| f[0] == "EVENT"));
    assert!(engine.store.get(&id).is_none());
    assert!(
        !late
            .iter()
            .any(|f| f["t"] == "result" && f["ok"] == Value::Bool(true))
    );
}
