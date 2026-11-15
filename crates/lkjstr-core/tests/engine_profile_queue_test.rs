#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Query},
};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
use serde_json::{Value, json};
fn event(kind: u64, at: u64) -> lkjstr_protocol::NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            tags: vec![],
            content: if kind == 0 {
                r#"{"name":"queued"}"#.into()
            } else {
                format!("note {at}")
            },
        },
        &generate_secret_key(),
    )
    .expect("fixture")
}
#[test]
fn profile_verification_precedes_bulk_notes_and_cannot_finish_before_verification() {
    let mut e = Engine::new();
    for at in 0..40 {
        e.enqueue("cache".into(), event(1, at));
    }
    let profile = event(0, 100);
    let author = profile.pubkey.clone();
    e.enqueue("cache".into(), profile);
    e.tick(75);
    assert_eq!(e.verified, 32);
    assert!(e.store.profile(&author).is_some());
    assert!(!e.network.profile_finished(&author, &[]));
}
#[test]
fn full_window_authors_are_requested_in_bounded_relay_batches() {
    let mut e = Engine::new();
    e.input(
        Input::Configure {
            relays: vec!["wss://relay.test".into()],
        },
        0,
    );
    let mut notes = Vec::new();
    for at in 0..301 {
        let note = event(1, at);
        e.store.insert(note.clone(), Some("wss://relay.test/"));
        notes.push(note);
    }
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        0,
    );
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor: Some(notes[200].id.clone()),
            before: 100,
            after: 200,
        },
        1,
    );
    e.network.connected("wss://relay.test/", 2);
    let frames: Vec<Value> = e
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, s) => Some(serde_json::from_str::<Value>(&s).expect("frame")),
            _ => None,
        })
        .filter(|f| f[0] == "REQ" && f[2]["kinds"] == json!([0]))
        .collect();
    let mut authors = std::collections::BTreeSet::new();
    for f in frames {
        let batch = f[2]["authors"].as_array().expect("authors");
        assert!(batch.len() <= 120);
        authors.extend(batch.iter().filter_map(Value::as_str).map(str::to_owned));
    }
    assert_eq!(authors.len(), 301);
}
