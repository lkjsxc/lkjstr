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
fn author_cap_refills_past_long_suppressed_runs_and_retained_anchors_progress() {
    let mut e = Engine::new();
    for at in 100..500 {
        e.store.insert(note(at, &"a".repeat(64)), None);
    }
    let oldest = note(99, &"b".repeat(64));
    e.store.insert(oldest.clone(), None);
    open(&mut e);
    let first = ids(&mut e);
    assert_eq!(first.len(), 4);
    assert_eq!(first.last(), Some(&oldest.id));
    e.input(
        Input::Window {
            sub: "feed".into(),
            anchor: Some(first[2].clone()),
            before: 0,
            after: 50,
        },
        1,
    );
    assert_eq!(ids(&mut e).last(), Some(&oldest.id));
}
#[test]
fn wholly_withheld_window_refills_cache_and_fetches_history_without_a_row_anchor() {
    let mut e = Engine::new();
    let relay = "wss://relay.test/";
    e.network.configure(vec![relay.into()], 0);
    for at in 100..160 {
        e.store.insert(note(at, &"a".repeat(64)), Some(relay));
    }
    open(&mut e);
    e.drain();
    e.network.connected(relay, 0);
    let frames = requests(&mut e.network);
    let profile = frames
        .iter()
        .find(|f| f[2]["kinds"] == json!([0]))
        .expect("profile");
    e.network
        .message(relay, &json!(["EOSE", profile[1]]).to_string(), 1);
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
    assert_eq!(ids(&mut e), vec![older.id]);

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
    let frames = requests(&mut e.network);
    let profile = frames
        .iter()
        .find(|f| f[2]["kinds"] == json!([0]))
        .expect("profile");
    e.network
        .message(relay, &json!(["EOSE", profile[1]]).to_string(), 1);
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
    let pages = requests(&mut e.network);
    assert!(pages.iter().any(|f| f[2]["until"] == 99));
    // Repeated ticks do not reopen the same cursor or release profile evidence.
    e.tick(300);
    assert!(requests(&mut e.network).is_empty());
    assert!(e.network.profile_absent(&"a".repeat(64)));
}
#[test]
fn profile_absence_requires_successful_untruncated_results_on_all_routes() {
    let relay = "wss://relay.test/";
    let author = "a".repeat(64);
    for outcome in ["empty", "closed", "timeout", "truncated"] {
        let mut n = Network::default();
        n.configure(vec![relay.into()], 0);
        n.relay_information(relay, r#"{"limitation":{"max_limit":1}}"#);
        n.plan(
            vec![(
                "view".into(),
                NostrFilter {
                    kinds: Some(vec![0]),
                    authors: Some(vec![author.clone(), "b".repeat(64)]),
                    limit: Some(2),
                    ..Default::default()
                },
                Query::default(),
            )],
            &lkjstr_core::store::Store::new(0),
            0,
        );
        n.connected(relay, 0);
        let frames = requests(&mut n);
        let id = frames[0][1].clone();
        assert!(!n.profile_absent(&author));
        if outcome == "truncated" {
            let mut profile = note(100, &"b".repeat(64));
            profile.kind = 0;
            n.message(relay, &json!(["EVENT", id, profile]).to_string(), 1);
        }
        match outcome {
            "closed" => {
                n.message(
                    relay,
                    &json!(["CLOSED", id, "blocked: fixture"]).to_string(),
                    2,
                );
            }
            "timeout" => n.tick(15001),
            _ => {
                n.message(relay, &json!(["EOSE", id]).to_string(), 2);
            }
        }
        assert!(n.profile_finished(&author, &[]), "{outcome}");
        assert_eq!(n.profile_absent(&author), outcome == "empty", "{outcome}");
        n.verifying = true;
        assert!(!n.profile_absent(&author));
    }
}

#[test]
fn successful_primary_and_failed_fallback_cannot_prove_profile_absence() {
    let routes = ["wss://primary.test/", "wss://fallback.test/"];
    let author = "a".repeat(64);
    let mut n = Network::default();
    n.configure(routes.iter().map(|r| (*r).into()).collect(), 0);
    n.plan(
        vec![(
            "view".into(),
            NostrFilter {
                kinds: Some(vec![0]),
                authors: Some(vec![author.clone()]),
                limit: Some(1),
                ..Default::default()
            },
            Query::default(),
        )],
        &lkjstr_core::store::Store::new(0),
        0,
    );
    n.connected(routes[0], 0);
    let primary = requests(&mut n);
    n.connected(routes[1], 0);
    let fallback = requests(&mut n);
    n.message(routes[0], &json!(["EOSE", primary[0][1]]).to_string(), 1);
    assert!(!n.profile_absent(&author));
    n.message(
        routes[1],
        &json!(["CLOSED", fallback[0][1], "blocked: fixture"]).to_string(),
        2,
    );
    assert!(n.profile_finished(&author, &[]));
    assert!(!n.profile_absent(&author));
}
