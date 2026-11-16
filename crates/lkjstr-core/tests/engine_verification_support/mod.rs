//! Raw EOSE cannot advance history past events waiting for bounded verification.
#![allow(dead_code, clippy::expect_used)]
#[path = "../engine_review_support/mod.rs"]
mod review_fixtures;
pub use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Output, Query, Source},
};
pub use lkjstr_protocol::NostrEvent;
pub use review_fixtures::event;
pub use serde_json::{Value, json};
pub const RELAY: &str = "wss://verification.test/";
pub const NOW: u64 = 1_700_001_000_000;
pub fn requests(engine: &mut Engine) -> Vec<Value> {
    let effects = engine.network.drain_effects();
    let mut requests = Vec::new();
    for effect in effects {
        let Effect::Send(url, text) = effect else {
            continue;
        };
        let frame: Value = serde_json::from_str(&text).expect("frame");
        if frame[0] != "REQ" {
            continue;
        }
        if frame
            .as_array()
            .is_some_and(|items| items.iter().skip(2).any(|f| f["kinds"] == json!([1, 6])))
        {
            requests.push(frame);
        } else {
            engine.network.message(
                &url,
                &json!(["EOSE", frame[1]]).to_string(),
                engine.network.now,
            );
        }
    }
    requests
}
pub fn setup() -> (Engine, Value) {
    let mut engine = Engine::default();
    engine.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        NOW,
    );
    engine.input(
        Input::Open {
            sub: "feed".into(),
            query: Query {
                source: Source::Relay,
                target: Some(RELAY.into()),
                ..Default::default()
            },
        },
        NOW,
    );
    engine.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 200,
        },
        NOW,
    );
    engine.network.connected(RELAY, NOW + 1);
    let request = requests(&mut engine)
        .into_iter()
        .next()
        .expect("initial page");
    (engine, request)
}
pub fn incoming(engine: &mut Engine, req: &Value, event: &NostrEvent, now: u64) {
    if let Some(event) =
        engine
            .network
            .message(RELAY, &json!(["EVENT", req[1], event]).to_string(), now)
    {
        engine.enqueue(RELAY.into(), event);
    }
}
pub fn eose(engine: &mut Engine, req: &Value, now: u64) {
    engine
        .network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), now);
}
pub fn diagnostics(engine: &mut Engine, now: u64) -> Value {
    engine.input(
        Input::Open {
            sub: "diagnostics".into(),
            query: Query {
                source: Source::Diagnostics,
                ..Default::default()
            },
        },
        now,
    );
    engine
        .drain()
        .into_iter()
        .rev()
        .find_map(|output| match output {
            Output::Diagnostics { data, .. } => Some(data),
            _ => None,
        })
        .expect("diagnostics")
}
pub fn full_page(engine: &mut Engine, req: &Value) {
    for index in 0..200 {
        let event = review_fixtures::event(1_700_000_200 - index, 1, "archive", vec![]);
        incoming(engine, req, &event, NOW + 2);
    }
    eose(engine, req, NOW + 3);
}
