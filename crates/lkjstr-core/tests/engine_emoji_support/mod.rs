#![allow(dead_code)]
use lkjstr_core::engine::{Engine, network::Effect, wire};
use lkjstr_protocol::{EventTemplate, NostrEvent, SecretKeyBytes, finalize_event};
use serde_json::{Value, json};
pub const RELAY: &str = "wss://emoji-loopback.test/";
pub fn signed(key: &SecretKeyBytes, at: u64, kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: String::new(),
            tags,
        },
        key,
    )
    .expect("valid fixture")
}
pub fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|v| (*v).into()).collect()
}
pub fn emoji(code: &str, url: &str) -> Vec<String> {
    tag(&["emoji", code, url])
}
pub fn set(key: &SecretKeyBytes, at: u64, identifier: &str, code: &str) -> NostrEvent {
    signed(
        key,
        at,
        30030,
        vec![
            tag(&["d", identifier]),
            emoji(code, &format!("https://images.test/{code}.png")),
        ],
    )
}
pub fn address(event: &NostrEvent) -> String {
    format!("30030:{}:{}", event.pubkey, event.tags[0][1])
}
pub fn accept(s: &mut wire::Session, e: &mut Engine, value: Value, now: u64) {
    for input in s
        .input(serde_json::from_value(value).expect("valid input"), e)
        .expect("supported input")
    {
        e.input(input, now);
    }
}
pub fn output(s: &mut wire::Session, e: &mut Engine) -> Vec<Value> {
    e.drain()
        .into_iter()
        .flat_map(|o| s.output(o, e))
        .map(|o| serde_json::to_value(o).expect("wire output"))
        .collect()
}
pub fn rows(e: &mut Engine, account: Option<&str>) -> Value {
    let mut s = wire::Session::default();
    accept(
        &mut s,
        e,
        json!({"t":"open","sub":"emoji","query":{"source":"emoji","account":account}}),
        100_000,
    );
    accept(
        &mut s,
        e,
        json!({"t":"window","sub":"emoji","anchor":"top","before":0,"after":400}),
        100_000,
    );
    output(&mut s, e)
        .into_iter()
        .rev()
        .find(|o| o["t"] == "rows")
        .expect("rows")
}
pub fn frames(e: &mut Engine) -> Vec<(String, Value)> {
    e.network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(relay, text) => Some((relay, serde_json::from_str(&text).expect("frame"))),
            _ => None,
        })
        .collect()
}
pub fn open(s: &mut wire::Session, e: &mut Engine, account: &str) {
    e.input(
        lkjstr_core::engine::protocol::Input::Configure {
            relays: vec![RELAY.into()],
        },
        100_000,
    );
    accept(
        s,
        e,
        json!({"t":"open","sub":"emoji","query":{"source":"emoji","account":account}}),
        100_000,
    );
    e.network.connected(RELAY, 100_000);
}
pub fn reply(e: &mut Engine, relay: &str, wire: &str, event: &NostrEvent, now: u64) {
    if let Some(event) = e
        .network
        .message(relay, &json!(["EVENT", wire, event]).to_string(), now)
    {
        e.enqueue(relay.into(), event);
    }
}
pub fn eose(e: &mut Engine, relay: &str, wire: &str, now: u64) {
    e.network
        .message(relay, &json!(["EOSE", wire]).to_string(), now);
}

pub fn snapshot(s: &mut wire::Session, e: &mut Engine, now: u64) -> Value {
    accept(
        s,
        e,
        json!({"t":"window","sub":"emoji","anchor":"top","before":0,"after":400}),
        now,
    );
    output(s, e)
        .into_iter()
        .rev()
        .find(|o| o["t"] == "rows")
        .expect("rows")
}
