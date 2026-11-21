#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::{Effect, Network},
    protocol::{Input, Output, Query},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};

fn note(at: u64, author: &str) -> NostrEvent {
    let mut e = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: format!("distinct {at}"),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("fixture");
    e.pubkey = author.into();
    e
}
fn requests(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, s) => Some(serde_json::from_str::<Value>(&s).expect("frame")),
            _ => None,
        })
        .filter(|v| v[0] == "REQ")
        .collect()
}
fn open(e: &mut Engine) {
    e.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        0,
    );
}
fn ids(e: &mut Engine) -> Vec<String> {
    e.drain()
        .into_iter()
        .filter_map(|o| match o {
            Output::Rows { items, .. } => Some(items.into_iter().map(|r| r.id).collect::<Vec<_>>()),
            _ => None,
        })
        .flatten()
        .collect()
}
#[test]
fn author_cap_preserves_slots_and_covered_anchors_page_to_older_notes() {
    let mut e = Engine::new();
    for at in 100..500 {
        e.store.insert(note(at, &"a".repeat(64)), None);
    }
    let oldest = note(99, &"b".repeat(64));
    e.store.insert(oldest.clone(), None);
    open(&mut e);
    let first = e
        .drain()
        .into_iter()
        .find_map(|output| match output {
            Output::Rows { items, .. } => Some(items),
            _ => None,
        })
        .expect("rows");
    assert_eq!(first.len(), 51);
    assert_eq!(
        first
            .iter()
            .skip(3)
            .filter(|row| row.hidden_reason
                == Some(lkjstr_core::engine::visibility::Reason::AuthorLimit))
            .count(),
        48
    );
    let mut last = first.last().expect("covered anchor").id.clone();
    for tick in 1..=8 {
        e.input(
            Input::Window {
                sub: "feed".into(),
                anchor: Some(last),
                before: 0,
                after: 50,
            },
            tick,
        );
        last = ids(&mut e).last().expect("requested window").clone();
        if last == oldest.id {
            return;
        }
    }
    assert_eq!(last, oldest.id);
}
#[test]
fn absent_profiles_keep_the_first_window_and_do_not_stop_relay_history() {
    let mut e = Engine::new();
    let relay = "wss://relay.test/";
    e.network.configure(vec![relay.into()], 0);
    for at in 100..160 {
        e.store.insert(note(at, &"a".repeat(64)), Some(relay));
    }
    open(&mut e);
    e.drain();
    e.network.connected(relay, 0);
    e.network.tick(75);
    let frames = requests(&mut e.network);
    let profile = frames
        .iter()
        .find(|f| f[2]["kinds"] == json!([0]))
        .expect("profile");
    e.network
        .message(relay, &json!(["EOSE", profile[1]]).to_string(), 76);
    e.tick(100);
    assert!(e.network.profile_absent(&"a".repeat(64)));
    let older = note(99, &"b".repeat(64));
    e.store.insert(older.clone(), None);
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 50,
        },
        102,
    );
    let first = e
        .drain()
        .into_iter()
        .find_map(|output| match output {
            Output::Rows { items, .. } => Some(items),
            _ => None,
        })
        .expect("rows");
    assert_eq!(first.len(), 51);
    assert_eq!(first[0].author.pubkey, "a".repeat(64));
    assert!(first[0].hidden_reason.is_none());
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor: Some(first[50].id.clone()),
            before: 0,
            after: 50,
        },
        103,
    );
    assert_eq!(ids(&mut e).last(), Some(&older.id));

    let mut e = Engine::new();
    e.network.configure(vec![relay.into()], 0);
    e.network
        .relay_information(relay, r#"{"limitation":{"max_limit":2}}"#);
    let notes = [note(100, &"a".repeat(64)), note(99, &"a".repeat(64))];
    for n in &notes {
        e.store.insert(n.clone(), Some(relay));
    }
    open(&mut e);
    e.drain();
    e.network.connected(relay, 0);
    e.network.tick(75);
    let frames = requests(&mut e.network);
    let profile = frames
        .iter()
        .find(|f| f[2]["kinds"] == json!([0]))
        .expect("profile");
    e.network
        .message(relay, &json!(["EOSE", profile[1]]).to_string(), 76);
    e.tick(100);
    let head = frames
        .iter()
        .find(|f| f[2]["kinds"] == json!([1, 6]))
        .expect("head");
    for n in &notes {
        e.network
            .message(relay, &json!(["EVENT", head[1], n]).to_string(), 101);
    }
    e.network
        .message(relay, &json!(["EOSE", head[1]]).to_string(), 102);
    e.tick(200);
    e.tick(300);
    let pages = requests(&mut e.network);
    assert!(pages.iter().any(|f| f[2]["until"] == 99));
    // Repeated ticks do not reopen the same cursor or release profile evidence.
    e.tick(400);
    assert!(requests(&mut e.network).is_empty());
    assert!(e.network.profile_absent(&"a".repeat(64)));
}
#[path = "engine_review_polish_cases/profiles.rs"]
mod profiles;
