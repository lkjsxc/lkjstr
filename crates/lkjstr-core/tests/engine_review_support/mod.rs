#![allow(dead_code)]
use lkjstr_core::engine::{Engine, network::Effect, protocol, wire};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::Value;
pub const RELAY: &str = "wss://local.test/";
pub fn event(at: u64, kind: u64, text: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
pub fn accept(s: &mut wire::Session, e: &mut Engine, value: Value, now: u64) {
    let input = serde_json::from_value(value).expect("wire input");
    for input in s.input(input, e).expect("supported") {
        e.input(input, now);
    }
}
pub fn output(s: &mut wire::Session, e: &mut Engine) -> Vec<Value> {
    e.drain()
        .into_iter()
        .flat_map(|o| s.output(o, e))
        .map(|o| serde_json::to_value(o).expect("output"))
        .collect()
}
pub fn frames(e: &mut Engine) -> Vec<Value> {
    e.network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}
pub fn window(e: &mut Engine, anchor: Option<String>, after: usize, now: u64) {
    e.input(
        protocol::Input::Window {
            sub: "feed".into(),
            anchor,
            before: 0,
            after,
        },
        now,
    );
}
pub fn open(e: &mut Engine, query: protocol::Query) {
    e.input(
        protocol::Input::Open {
            sub: "feed".into(),
            query,
        },
        0,
    );
}
