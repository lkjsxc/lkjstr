#![allow(dead_code)]
use lkjstr_core::engine::{Engine, network::Effect, protocol::Output, wire::Session};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
use serde_json::{Value, json};

pub type Test<T = ()> = Result<T, Box<dyn std::error::Error>>;
pub const RELAY: &str = "wss://acts.test/";

pub fn event(
    seed: u64,
    at: u64,
    kind: u64,
    text: &str,
    tags: Vec<Vec<String>>,
) -> Test<NostrEvent> {
    Ok(finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        &parse_secret_key_hex(&format!("{seed:064x}")).ok_or("fixture secret")?,
    )
    .map_err(|_| "fixture signing failed")?)
}

pub fn act(seed: u64, at: u64, kind: u64, text: &str, target: &NostrEvent) -> Test<NostrEvent> {
    event(
        seed,
        at,
        kind,
        text,
        vec![
            vec!["e".into(), target.id.clone()],
            vec!["p".into(), target.pubkey.clone()],
        ],
    )
}

pub fn put(engine: &mut Engine, events: &[&NostrEvent]) {
    for event in events {
        engine.store.insert((*event).clone(), None);
    }
}

pub fn input(session: &mut Session, engine: &mut Engine, message: Value, now: u64) -> Test {
    let input = serde_json::from_value(message)?;
    for input in session.input(input, engine).map_err(|(_, code)| code)? {
        engine.input(input, now);
    }
    Ok(())
}

pub fn open(session: &mut Session, engine: &mut Engine, sub: &str, query: Value, now: u64) -> Test {
    if query["source"] == "profile" {
        let typed: lkjstr_core::engine::wire::queries::Query =
            serde_json::from_value(query.clone())?;
        let converted = typed.convert().ok_or("profile query premise")?;
        assert!(
            converted.target.is_some(),
            "profile query must have an actual person"
        );
        assert_eq!(converted.target.as_deref(), query["pubkey"].as_str());
        assert_eq!(converted.filters.show.as_deref(), query["show"].as_str());
        assert!(
            !lkjstr_core::engine::query::events(&engine.store, &converted).is_empty(),
            "profile query premise: the selected person's signed acts are admitted"
        );
    }
    input(
        session,
        engine,
        json!({"t":"open","sub":sub,"query":query}),
        now,
    )
}

pub fn output(session: &mut Session, engine: &mut Engine) -> Test<Vec<Value>> {
    let pending = engine.drain();
    let mut messages = vec![];
    for message in pending {
        for value in session.output(message, engine) {
            messages.push(serde_json::to_value(value)?);
        }
    }
    Ok(messages)
}

pub fn rows(messages: &[Value]) -> Vec<Value> {
    messages
        .iter()
        .filter(|m| m["t"] == "rows")
        .filter_map(|m| m["rows"].as_array())
        .flat_map(|rows| rows.iter().cloned())
        .collect()
}

pub fn row(messages: &[Value], key: &str) -> Test<Value> {
    rows(messages)
        .into_iter()
        .chain(
            messages
                .iter()
                .filter(|m| m["t"] == "patch")
                .filter_map(|m| m["ops"].as_array())
                .flatten()
                .filter_map(|op| op.get("row").cloned()),
        )
        .find(|r| r["key"] == key)
        .ok_or_else(|| "expected projected row".into())
}

pub fn frame_requests(engine: &mut Engine) -> Test<Vec<Value>> {
    let mut requests = vec![];
    for effect in engine.network.drain_effects() {
        if let Effect::Send(_, text) = effect {
            let frame: Value = serde_json::from_str(&text)?;
            if frame[0] == "REQ" {
                requests.push(frame);
            }
        }
    }
    Ok(requests)
}

pub fn news(account: &str) -> Value {
    json!({"source":"notifications","account":account})
}

pub fn profile(account: &str, person: &str, show: &str) -> Value {
    json!({"source":"profile","account":account,"pubkey":person,"show":show})
}

pub fn request(engine: &mut Engine, predicate: impl Fn(&Value) -> bool) -> Test<String> {
    let mut observed = vec![];
    for step in 1..=40 {
        engine.network.tick(step * 250);
        for frame in frame_requests(engine)? {
            observed.push(frame.clone());
            let wire = frame[1].as_str().ok_or("request wire")?.to_owned();
            if frame
                .as_array()
                .ok_or("REQ array")?
                .iter()
                .skip(2)
                .any(&predicate)
            {
                return Ok(wire);
            }
            engine
                .network
                .message(RELAY, &json!(["EOSE", wire]).to_string(), step * 250);
        }
    }
    Err(format!(
        "expected owned lookup was not dispatched; observed={observed:?}; network={:?}",
        engine.network.stats()
    )
    .into())
}

pub fn status(session: &mut Session, engine: &Engine) -> Test<Vec<Value>> {
    session
        .output(
            Output::Status {
                sub: "news".into(),
                state: "complete".into(),
                asked_relays: 1,
                answered_relays: 1,
            },
            engine,
        )
        .into_iter()
        .map(|v| Ok(serde_json::to_value(v)?))
        .collect()
}
