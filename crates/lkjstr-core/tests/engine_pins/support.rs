#![allow(dead_code, clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{Engine, network::Effect, protocol, wire};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, UnsignedNostrEvent, finalize_event,
    parse_secret_key_hex,
};
use serde_json::{Value, json};

pub const RELAY: &str = "wss://pins.test/";
pub const OTHER: &str = "wss://other-pins.test/";
pub const NOW: u64 = 100_000;

pub fn key(seed: u8) -> SecretKeyBytes {
    parse_secret_key_hex(&format!("{seed:02x}").repeat(32)).expect("deterministic fixture key")
}
pub fn event(seed: u8, kind: u64, at: u64, text: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        &key(seed),
    )
    .expect("deterministic fixture event")
}
pub fn pin_tag(id: &str) -> Vec<String> {
    vec!["e".into(), id.into()]
}
pub fn request(
    engine: &mut Engine,
    req: &str,
    account: &str,
    id: &str,
    on: bool,
) -> Vec<protocol::Output> {
    engine.input(
        protocol::Input::Action {
            req: req.into(),
            account: account.into(),
            action: protocol::Action::Pin {
                id: id.into(),
                value: on,
            },
        },
        NOW,
    );
    engine.drain()
}
pub fn unsigned(out: Vec<protocol::Output>) -> UnsignedNostrEvent {
    out.into_iter()
        .find_map(|out| match out {
            protocol::Output::Sign { event, .. } => Some(event),
            _ => None,
        })
        .expect("pin edit reaches signer")
}
pub fn signed(seed: u8, unsigned: UnsignedNostrEvent) -> NostrEvent {
    event(
        seed,
        unsigned.kind,
        unsigned.created_at,
        &unsigned.content,
        unsigned.tags,
    )
}
pub fn finish(
    engine: &mut Engine,
    req: &str,
    seed: u8,
    unsigned: UnsignedNostrEvent,
) -> Vec<protocol::Output> {
    engine.input(
        protocol::Input::Signed {
            req: req.into(),
            event: Some(signed(seed, unsigned)),
            error: None,
        },
        NOW + 1,
    );
    engine.drain()
}
pub fn error(out: Vec<protocol::Output>, expected: &str) {
    assert!(
        out.iter()
            .any(|out| matches!(out, protocol::Output::Error { code, .. } if code == expected)),
        "expected {expected}, got {out:?}"
    );
    assert!(
        !out.iter()
            .any(|out| matches!(out, protocol::Output::Sign { .. }))
    );
}
pub fn accept(session: &mut wire::Session, engine: &mut Engine, input: Value, now: u64) {
    let input = serde_json::from_value(input).expect("wire input");
    for command in session
        .input(input, engine)
        .expect("supported wire command")
    {
        engine.input(command, now);
    }
}
pub fn output(session: &mut wire::Session, engine: &mut Engine) -> Vec<Value> {
    engine
        .drain()
        .into_iter()
        .flat_map(|out| session.output(out, engine))
        .map(|out| serde_json::to_value(out).expect("wire output"))
        .collect()
}
pub fn rows(session: &mut wire::Session, engine: &mut Engine, sub: &str) -> Value {
    output(session, engine)
        .into_iter()
        .rfind(|out| out["t"] == "rows" && out["sub"] == sub)
        .expect("wire rows")
}
pub fn frames(engine: &mut Engine) -> Vec<Value> {
    engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("relay frame")),
            _ => None,
        })
        .collect()
}
pub fn configure(engine: &mut Engine, relays: &[&str]) {
    engine.input(
        protocol::Input::Configure {
            relays: relays.iter().map(|r| (*r).into()).collect(),
        },
        NOW,
    );
}
pub fn relay_event(engine: &mut Engine, relay: &str, req: &Value, item: &NostrEvent, now: u64) {
    let received = engine
        .network
        .message(relay, &json!(["EVENT", req[1], item]).to_string(), now)
        .expect("requested relay event");
    engine.enqueue(relay.into(), received);
}
pub fn eose(engine: &mut Engine, relay: &str, req: &Value, now: u64) {
    engine
        .network
        .message(relay, &json!(["EOSE", req[1]]).to_string(), now);
}
pub fn filter_for(frames: &[Value], kind: u64) -> &Value {
    frames
        .iter()
        .find(|frame| frame[0] == "REQ" && frame[2]["kinds"] == json!([kind]))
        .unwrap_or_else(|| panic!("missing kind {kind} request: {frames:?}"))
}
pub fn ids(rows: &Value) -> Vec<&str> {
    rows["rows"]
        .as_array()
        .expect("rows array")
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect()
}
