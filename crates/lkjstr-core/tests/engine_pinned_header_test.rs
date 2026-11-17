#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    Engine,
    wire::{Input, Output, Session},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};

fn signed(
    secret: &lkjstr_protocol::SecretKeyBytes,
    kind: u64,
    at: u64,
    text: &str,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        secret,
    )
    .expect("fixture signature")
}
fn send(session: &mut Session, engine: &mut Engine, input: Value) {
    let parsed = serde_json::from_value::<Input>(input).expect("input");
    for command in session.input(parsed, engine).expect("supported input") {
        engine.input(command, 100_000);
    }
}
fn rows(session: &mut Session, engine: &mut Engine) -> Value {
    engine
        .drain()
        .into_iter()
        .flat_map(|msg| session.output(msg, engine))
        .filter_map(|msg| match msg {
            Output::Rows { .. } => Some(serde_json::to_value(msg).expect("wire rows")),
            _ => None,
        })
        .last()
        .expect("rows delivered")
}
fn pinned_window(source: &str) {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let key = generate_secret_key();
    let profile = signed(&key, 0, 80, r#"{"name":"Pinned"}"#, vec![]);
    let channel = signed(&key, 40, 81, r#"{"name":"Pinned channel"}"#, vec![]);
    let target = if source == "profile" {
        profile.pubkey.clone()
    } else {
        channel.id.clone()
    };
    let tags = if source == "channel" {
        vec![vec![
            "e".into(),
            channel.id.clone(),
            "".into(),
            "root".into(),
        ]]
    } else {
        vec![]
    };
    let kind = if source == "channel" { 42 } else { 1 };
    let newest = signed(&key, kind, 93, "newest note", tags.clone());
    let older = signed(&key, kind, 92, "older note", tags);
    engine.store.insert(profile, None);
    engine.store.insert(channel, None);
    engine.store.insert(newest.clone(), None);
    engine.store.insert(older.clone(), None);
    let query = if source == "profile" {
        json!({"source":"profile","pubkey":target,"show":"posts"})
    } else {
        json!({"source":"channel","id":target})
    };
    send(
        &mut session,
        &mut engine,
        json!({"t":"open","sub":"p","query":query}),
    );
    let opened = rows(&mut session, &mut engine);
    assert_eq!(
        opened["rows"][0]["kind"], source,
        "structural header on opening"
    );
    assert!(
        opened["rows"].as_array().expect("rows").len() >= 3,
        "two fixture notes"
    );

    send(
        &mut session,
        &mut engine,
        json!({
            "t":"window","sub":"p","anchor":{"key":older.id},"before":0,"after":1
        }),
    );
    let scrolled = rows(&mut session, &mut engine);
    assert_eq!(
        scrolled["rows"][0]["kind"], source,
        "header remains after deep anchor"
    );
    assert_eq!(
        scrolled["rows"][1]["key"], older.id,
        "only the requested note"
    );
    assert_eq!(
        scrolled["rows"].as_array().expect("rows").len(),
        2,
        "no extra older or newer notes"
    );
    assert_eq!(scrolled["atTop"], false, "an older note is not the top");

    send(
        &mut session,
        &mut engine,
        json!({
            "t":"window","sub":"p","anchor":{"key":newest.id},"before":0,"after":1
        }),
    );
    let first = rows(&mut session, &mut engine);
    assert_eq!(first["rows"][0]["kind"], source);
    assert_eq!(first["rows"][1]["key"], newest.id);
    assert_eq!(
        first["atTop"], true,
        "structural header does not count as an unseen note"
    );

    send(
        &mut session,
        &mut engine,
        json!({
            "t":"window","sub":"p","anchor":{"key":newest.id},"before":0,"after":0
        }),
    );
    let empty = rows(&mut session, &mut engine);
    assert_eq!(empty["rows"].as_array().expect("rows").len(), 1);
    assert_eq!(
        empty["rows"][0]["kind"], source,
        "zero note window still owns its header"
    );
}
#[test]
fn profile_header_survives_scrolled_and_empty_note_windows() {
    pinned_window("profile");
}
#[test]
fn channel_header_survives_scrolled_and_empty_note_windows() {
    pinned_window("channel");
}
