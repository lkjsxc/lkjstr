#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::{Value, json};

#[test]
fn muted_contact_payloads_do_not_drain_follower_history_before_scroll() {
    let mut e = Engine::new();
    let target = "a".repeat(64);
    let mute = event(1, 10000, "", vec![vec!["word".into(), "blocked".into()]]);
    let owner = mute.pubkey.clone();
    e.store.insert(mute, None);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    e.network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":60}}"#);
    let mut s = Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"followers","pubkey":target,"account":owner}}),
        0,
    );
    output(&mut s, &mut e);
    e.network.connected(RELAY, 1);
    let req = frames(&mut e)
        .into_iter()
        .find(|f| f[0] == "REQ" && f[2]["#p"] == json!([target]))
        .expect("followers");
    let mut oldest = String::new();
    for at in 100..160 {
        let contact = event(at, 3, "blocked", vec![vec!["p".into(), target.clone()]]);
        if at == 100 {
            oldest = contact.pubkey.clone();
        }
        let contact = e
            .network
            .message(RELAY, &json!(["EVENT", req[1], contact]).to_string(), 2)
            .expect("contact");
        e.network.event(RELAY, &contact, 2);
        e.store.insert(contact, Some(RELAY));
    }
    e.network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 3);
    let mut sent = Vec::new();
    for now in [4, 100, 200, 300] {
        e.tick(now);
        sent.extend(frames(&mut e));
    }
    let history =
        |f: &Value| f[0] == "REQ" && f[2]["#p"] == json!([target]) && f[2]["until"].is_number();
    assert!(
        !sent.iter().any(&history),
        "the first 50 person rows are already filled"
    );
    output(&mut s, &mut e);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":"top","before":0,"after":50}),
        350,
    );
    let out = output(&mut s, &mut e);
    let rows = out.iter().find(|o| o["t"] == "rows").expect("people");
    assert_eq!(rows["rows"].as_array().expect("rows").len(), 50);
    assert_eq!(rows["atBottom"], false);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":oldest},"before":0,"after":60}),
        400,
    );
    e.network.connected(RELAY, 401);
    e.tick(500);
    assert!(
        frames(&mut e).iter().any(history),
        "scrolling to the tail must still page"
    );
}
