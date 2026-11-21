#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{accept, output};
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};

fn sign(key: &SecretKeyBytes, at: u64, kind: u64, text: &str, tags: &[&[&str]]) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags: tags
                .iter()
                .map(|tag| tag.iter().map(|value| (*value).into()).collect())
                .collect(),
        },
        key,
    )
    .expect("signed fixture")
}

fn ingest(engine: &mut Engine, at: u64, events: &[&NostrEvent]) {
    for event in events {
        engine.enqueue("cache".into(), (*event).clone());
    }
    engine.tick(at);
}

fn open(
    engine: &mut Engine,
    session: &mut Session,
    sub: &str,
    query: Value,
    at: u64,
) -> Vec<Value> {
    accept(
        session,
        engine,
        json!({"t":"open","sub":sub,"query":query}),
        at,
    );
    output(session, engine)
        .into_iter()
        .find(|message| message["t"] == "rows" && message["sub"] == sub)
        .expect("open rows")["rows"]
        .as_array()
        .expect("row array")
        .clone()
}

fn row<'a>(rows: &'a [Value], event: &NostrEvent) -> &'a Value {
    rows.iter()
        .find(|row| row["id"] == event.id)
        .expect("verified row")
}

fn action(
    session: &mut Session,
    engine: &Engine,
    sub: &str,
    key: &str,
    reveal: bool,
) -> Vec<Value> {
    session
        .note_reveal("req".into(), sub, key, reveal, engine)
        .into_iter()
        .map(|message| serde_json::to_value(message).expect("wire JSON"))
        .collect()
}

#[path = "engine_visibility_cases/sources.rs"]
mod sources;
#[path = "engine_visibility_cases/terminal.rs"]
mod terminal;
