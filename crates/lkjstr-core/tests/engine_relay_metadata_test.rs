#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Output, Query, Source},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
const BASE: u64 = 200_000;
const FALLBACK: &str = "wss://fallback.test/";
const WRITER: &str = "wss://writer.test/";
fn sign(key: &SecretKeyBytes, kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 100,
            kind,
            content: content.into(),
            tags,
        },
        key,
    )
    .expect("signed fixture")
}
fn engine() -> Engine {
    let mut engine = Engine::new();
    engine.input(
        Input::Configure {
            relays: vec![FALLBACK.into()],
        },
        BASE,
    );
    engine
}
fn requests(engine: &mut Engine) -> Vec<(String, Value)> {
    engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| {
            let Effect::Send(url, text) = effect else {
                return None;
            };
            let frame: Value = serde_json::from_str(&text).expect("frame");
            (frame[0] == "REQ").then_some((url, frame))
        })
        .collect()
}
#[test]
fn stale_cached_names_render_immediately_and_revalidate_once_in_background() {
    let mut engine = engine();
    let key = generate_secret_key();
    let note = sign(&key, 1, "cached note", vec![]);
    engine.store.insert(note.clone(), Some("cache"));
    engine.store.insert(
        sign(&key, 0, r#"{"name":"cached-name"}"#, vec![]),
        Some("cache"),
    );
    engine.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        BASE,
    );
    assert!(
        engine
            .drain()
            .iter()
            .any(|output| matches!(output, Output::Rows { items, .. }
        if items.iter().any(|row| row.author.name == "cached-name")))
    );
    engine.network.connected(FALLBACK, BASE + 1);
    engine.network.tick(BASE + 25);
    assert!(
        !requests(&mut engine)
            .iter()
            .any(|(_, frame)| frame[2]["kinds"] == json!([0]))
    );
    engine.network.tick(BASE + 125);
    let frames = requests(&mut engine);
    assert_eq!(
        frames
            .iter()
            .filter(|(_, frame)| frame[2]["kinds"] == json!([0])
                && frame[2]["authors"] == json!([note.pubkey]))
            .count(),
        1
    );
}
#[test]
fn visible_profiles_reuse_an_already_open_delivering_outbox() {
    let mut engine = engine();
    let key = generate_secret_key();
    let note = sign(&key, 1, "outbox note", vec![]);
    engine.store.insert(note.clone(), Some(WRITER));
    engine.store.insert(
        sign(
            &key,
            10002,
            "",
            vec![vec!["r".into(), WRITER.into(), "write".into()]],
        ),
        None,
    );
    let query = Query {
        source: Source::Profile,
        target: Some(note.pubkey.clone()),
        ..Default::default()
    };
    engine.input(
        Input::Open {
            sub: "profile".into(),
            query: query.clone(),
        },
        BASE,
    );
    engine.network.connected(WRITER, BASE + 1);
    requests(&mut engine);
    engine.input(
        Input::Open {
            sub: "profile".into(),
            query,
        },
        BASE + 5,
    );
    engine.network.tick(BASE + 55);
    assert!(
        requests(&mut engine)
            .iter()
            .any(|(url, frame)| url == WRITER
                && frame[2]["kinds"] == json!([0])
                && frame[2]["authors"] == json!([note.pubkey]))
    );
}
