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
#[path = "engine_visibility_cases/their_home.rs"]
mod their_home;
#[path = "engine_visibility_cases/their_home_live.rs"]
mod their_home_live;
#[path = "engine_visibility_cases/their_home_reposts.rs"]
mod their_home_reposts;

#[test]
fn restoring_a_keyed_window_emits_only_the_requested_rows() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let writer = generate_secret_key();
    let notes = (10..110)
        .map(|at| sign(&writer, at, 1, &format!("Cached note {at}"), &[]))
        .collect::<Vec<_>>();
    for note in &notes {
        engine.store.insert(note.clone(), None);
    }
    let anchor = &notes[21];
    accept(
        &mut session,
        &mut engine,
        json!({
            "t": "open",
            "sub": "resume",
            "query": {"source": "home", "account": anchor.pubkey},
            "window": {"anchor": {"key": anchor.id}, "before": 7, "after": 8}
        }),
        120_000,
    );
    let snapshots: Vec<_> = output(&mut session, &mut engine)
        .into_iter()
        .filter(|message| message["t"] == "rows" && message["sub"] == "resume")
        .collect();
    assert_eq!(snapshots.len(), 1);
    let rows = snapshots[0]["rows"].as_array().expect("restored rows");
    let ids: Vec<_> = rows.iter().filter_map(|row| row["key"].as_str()).collect();
    let expected: Vec<_> = notes[14..=28]
        .iter()
        .rev()
        .map(|note| note.id.as_str())
        .collect();
    assert_eq!(ids, expected);
}

#[test]
fn restored_account_discovery_waits_for_a_visible_page() {
    use lkjstr_core::engine::{network::Effect, protocol::Input};

    let mut engine = Engine::new();
    let relay = "wss://resume.test/".to_owned();
    let account = sign(&generate_secret_key(), 30, 1, "Cached note", &[]).pubkey;
    let hint = |page_hidden| Input::Hint {
        focused_sub: None,
        visible_subs: vec![],
        page_hidden,
        idle: false,
        save_data: false,
    };
    engine.input(
        Input::Configure {
            relays: vec![relay.clone()],
        },
        120_000,
    );
    engine.input(hint(true), 120_001);
    engine.discover_account(Some(account), vec![relay.clone()], 120_002);
    engine.tick(120_026);
    assert!(
        !engine
            .network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(_)))
    );
    engine.input(hint(false), 120_050);
    engine.tick(120_075);
    assert!(
        engine
            .network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == &relay))
    );
}
