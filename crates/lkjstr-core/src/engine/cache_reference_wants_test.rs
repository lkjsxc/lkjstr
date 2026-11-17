//! Held references are owned public wants; no store hit or closed owner requests again.
#![allow(clippy::expect_used)]
use super::*;
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
fn open(engine: &mut Engine, sub: &str, account: Option<String>) {
    engine.input(
        Input::Open {
            sub: sub.into(),
            query: Query {
                source: protocol::Source::Global,
                account,
                ..Default::default()
            },
        },
        100,
    );
}
fn event(kind: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: 1,
            content: "public".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}
#[test]
fn reference_gaps_are_bounded_and_stop_when_store_or_visibility_answers() {
    let mut engine = Engine::new();
    open(&mut engine, "a", None);
    open(&mut engine, "b", None);
    let held = event(1);
    engine.store.insert(held.clone(), None);
    let missing = "a".repeat(64);
    engine.cache_references(
        vec![
            (
                "a".into(),
                vec![held.id, missing.clone(), missing.clone(), "bad".into()],
            ),
            ("unknown".into(), vec!["b".repeat(64)]),
        ],
        101,
    );
    let wants = engine.cache_reference_wants();
    assert_eq!(wants.len(), 1);
    assert_eq!(wants[0].0, "a");
    assert_eq!(wants[0].1.ids, Some(vec![missing]));
    let ids: Vec<_> = (0..2000).map(|n| format!("{n:064x}")).collect();
    engine.cache_references(vec![("a".into(), ids)], 102);
    assert_eq!(
        engine
            .cache_reference_wants()
            .iter()
            .map(|(_, f, _)| f.ids.as_ref().map_or(0, Vec::len))
            .sum::<usize>(),
        1600
    );
    engine.input(
        Input::Hint {
            visible_subs: vec!["b".into()],
            focused_sub: Some("b".into()),
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        103,
    );
    assert!(engine.cache_reference_wants().is_empty());
    engine.cache_references(vec![("b".into(), vec!["c".repeat(64)])], 104);
    engine.input(Input::Close { sub: "b".into() }, 105);
    assert!(engine.cache_reference_wants().is_empty());
}
#[test]
fn replacement_empty_and_private_policy_revoke_the_entire_registry() {
    let mut engine = Engine::new();
    let policy = event(10000);
    engine.store.insert(policy.clone(), None);
    open(&mut engine, "view", Some(policy.pubkey.clone()));
    engine.cache_references(vec![("view".into(), vec!["a".repeat(64)])], 101);
    assert_eq!(engine.cache_reference_wants().len(), 1);
    engine.cache_references(vec![], 102);
    assert!(engine.cache_reference_wants().is_empty());
    engine.cache_references(vec![("view".into(), vec!["b".repeat(64)])], 103);
    engine.private_lists.insert(
        policy.id,
        vec![vec!["word".into(), "secret membership".into()]],
    );
    assert!(engine.cache_reference_wants().is_empty());
    engine.cache_references(vec![("view".into(), vec!["c".repeat(64)])], 104);
    assert!(engine.cache_reference_wants().is_empty());
}
#[test]
fn reopened_identity_and_unknown_shared_client_cannot_retain_old_wants() {
    let mut engine = Engine::new();
    open(&mut engine, "view", None);
    engine.cache_references(vec![("view".into(), vec!["d".repeat(64)])], 100);
    open(&mut engine, "view", None);
    assert!(engine.cache_reference_wants().is_empty());
    let mut clients = clients::Clients::default();
    let first = clients.connect(100).expect("client");
    let second = clients.connect(100).expect("client");
    clients.input(
        first,
        Input::Open {
            sub: "view".into(),
            query: Query {
                source: protocol::Source::Global,
                ..Default::default()
            },
        },
        100,
    );
    assert_eq!(
        clients.subscription(first, "view"),
        Some(format!("{first}:view"))
    );
    assert_eq!(clients.subscription(second, "view"), None);
    clients.disconnect(first);
    assert_eq!(clients.subscription(first, "view"), None);
}
