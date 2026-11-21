#![allow(clippy::expect_used, clippy::unwrap_used)]
mod engine_review_support;
use engine_review_support::{accept, event, output};
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};

fn tagged(kind: &str, value: &str) -> Vec<Vec<String>> {
    vec![vec![kind.into(), value.into()]]
}

fn sign(key: &SecretKeyBytes, kind: u64, at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            tags,
            content: String::new(),
        },
        key,
    )
    .unwrap()
}

fn open(session: &mut Session, engine: &mut Engine, query: Value) {
    accept(
        session,
        engine,
        json!({"t":"open","sub":"feed","query":query}),
        0,
    );
    output(session, engine);
}

fn report(messages: &[Value]) -> &Value {
    messages
        .iter()
        .rfind(|out| out["t"] == "timeWindow")
        .unwrap()
}

fn seek(
    session: &mut Session,
    engine: &mut Engine,
    at: u64,
    before: u64,
    after: u64,
) -> Vec<Value> {
    accept(
        session,
        engine,
        json!({"t":"window","sub":"feed","anchor":{"at":at},"before":before,"after":after}),
        1,
    );
    output(session, engine)
}
#[test]
fn pivot_uses_bounded_distinct_sides_and_stable_timestamp_ties() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let mut notes = [1, 9, 10, 10, 11, 13].map(|at| event(at, 1, "note", vec![]));
    notes[2..4].sort_by(|a, b| b.id.cmp(&a.id));
    let owner = event(
        30,
        3,
        "",
        notes
            .iter()
            .flat_map(|note| tagged("p", &note.pubkey))
            .collect(),
    );
    for note in notes.iter().chain([&owner]) {
        engine.store.insert(note.clone(), None);
    }
    open(
        &mut session,
        &mut engine,
        json!({"source":"their-home","pubkey":owner.pubkey}),
    );
    let messages = seek(&mut session, &mut engine, 10_999, 1, 3);
    let rows = messages.iter().find(|out| out["t"] == "rows").unwrap();
    let selected: Vec<_> = rows["rows"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["key"].as_str().unwrap())
        .collect();
    assert_eq!(
        selected,
        [&notes[4].id, &notes[2].id, &notes[3].id, &notes[1].id]
    );
    assert_eq!(rows["atTop"], false);
    assert_eq!(rows["atBottom"], false);
    assert_eq!(
        report(&messages),
        &json!({
            "t":"timeWindow","sub":"feed","at":10_999,"key":notes[2].id,
            "newer":"cache-only","older":"cache-only",
            "followList":{"state":"latest-verified","at":30_000,"id":owner.id}
        })
    );
    let newer_only = seek(&mut session, &mut engine, 0, 1, 8);
    assert_eq!(report(&newer_only)["key"], notes[0].id);
    let empty = seek(&mut session, &mut engine, 0, 0, 8);
    assert!(report(&empty).get("key").is_none());
    assert_eq!(report(&empty)["older"], "cache-only");
}

#[test]
fn visible_pivot_recomputes_after_follow_discovery_and_replacement() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let a = event(8, 1, "old follow", vec![]);
    let b = event(12, 1, "new follow", vec![]);
    let key = generate_secret_key();
    let first_list = sign(&key, 3, 21, tagged("p", &a.pubkey));
    let latest = sign(&key, 3, 22, tagged("p", &b.pubkey));
    for note in [&a, &b] {
        engine.store.insert(note.clone(), None);
    }
    open(
        &mut session,
        &mut engine,
        json!({"source":"their-home","pubkey":latest.pubkey}),
    );
    let initial = seek(&mut session, &mut engine, 10_000, 1, 1);
    assert_eq!(report(&initial)["followList"], json!({"state":"unknown"}));
    assert!(report(&initial).get("key").is_none());
    for (now, list, note) in [(100, first_list, a), (200, latest, b)] {
        engine.store.insert(list.clone(), None);
        engine.invalidate();
        engine.tick(now);
        let messages = output(&mut session, &mut engine);
        assert_eq!(report(&messages)["key"], note.id);
        assert_eq!(report(&messages)["followList"]["id"], list.id);
        assert_eq!(report(&messages)["at"], 10_000);
    }
    accept(
        &mut session,
        &mut engine,
        json!({"t":"window","sub":"feed","anchor":"top","before":0,"after":2}),
        300,
    );
    assert!(
        output(&mut session, &mut engine)
            .iter()
            .all(|out| out["t"] != "timeWindow")
    );
}

#[test]
fn reposts_use_the_displayed_time_of_a_matching_repost() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    let original = event(4, 1, "reposted", vec![]);
    let near = event(8, 1, "newer", vec![]);
    let hidden = event(9, 1, "muted", vec![]);
    let key = generate_secret_key();
    let tags = [&near, &hidden]
        .into_iter()
        .flat_map(|note| tagged("p", &note.pubkey))
        .collect();
    let contact = sign(&key, 3, 20, tags);
    let mute = sign(&key, 10000, 20, tagged("p", &hidden.pubkey));
    let repost = sign(&key, 6, 25, tagged("e", &original.id));
    let unrelated = event(30, 6, "", tagged("e", &original.id));
    for row in [
        &original, &near, &hidden, &contact, &mute, &repost, &unrelated,
    ] {
        engine.store.insert(row.clone(), None);
    }
    open(
        &mut session,
        &mut engine,
        json!({"source":"home","account":contact.pubkey}),
    );
    let messages = seek(&mut session, &mut engine, 26_000, 1, 2);
    let rows = messages.iter().find(|out| out["t"] == "rows").unwrap();
    assert_eq!(rows["rows"][0]["id"], original.id);
    assert_eq!(rows["rows"][0]["repostedBy"]["at"], 25_000);
    assert_eq!(rows["rows"][1]["id"], hidden.id);
    assert_eq!(rows["rows"][1]["hidden"]["reason"], "muted-person");
    assert_eq!(report(&messages)["key"], original.id);
}

#[test]
fn non_chronological_sources_report_unsupported_without_replacing_rows() {
    let mut engine = Engine::new();
    let mut session = Session::default();
    open(&mut session, &mut engine, json!({"source":"thread"}));
    let messages = seek(&mut session, &mut engine, 42, 1, 1);
    assert_eq!(
        messages,
        vec![
            json!({"t":"timeWindow","sub":"feed","at":42,"newer":"unsupported","older":"unsupported"})
        ]
    );
}
