#![allow(clippy::expect_used)]
use super::*;
use crate::{
    cache::{
        Record,
        context::{Context, Limits, merge_contexts, read_contexts},
    },
    engine::wire::{Input, queries::Query},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::json;
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn event(key: &SecretKeyBytes, kind: u64, at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content: "public".into(),
            tags,
        },
        key,
    )
    .expect("signed fixture")
}
fn deletion(key: &SecretKeyBytes, id: &str) -> NostrEvent {
    event(key, 5, 99, vec![vec!["e".into(), id.into()]])
}
fn session() -> Session {
    let mut session = Session::default();
    session.queries.insert(
        "view".into(),
        Query {
            source: "global".into(),
            ..Default::default()
        },
    );
    session
}
fn hold(session: &mut Session, engine: &Engine, rows: serde_json::Value) -> Result {
    let input: Input = serde_json::from_value(json!({"t":"cache.hold","sub":"view","rows":rows}))?;
    assert!(session.input(input, engine).map_err(|(_, e)| e)?.is_empty());
    assert!(!session.delivered.contains_key("view"));
    Ok(())
}
#[test]
fn a_claimed_author_and_a_deletion_alone_do_not_authorize_removal() -> Result {
    let key = generate_secret_key();
    let note = event(&key, 1, 1, vec![]);
    let mut engine = Engine::new();
    engine.store.insert(deletion(&key, &note.id), None);
    let mut view = session();
    hold(&mut view, &engine, json!([{"key":note.id,"id":note.id}]))?;
    assert!(view.cache_refresh(&engine).is_empty());
    assert_eq!(view.cache_missing_ids(&engine), vec![note.id.clone()]);
    engine.restore_cache(&[Record::verified(&note)?]);
    // Proving the deletion is itself a revision, even without a local-load ack.
    let out = view.cache_refresh(&engine);
    assert_eq!(
        serde_json::to_value(&out[0])?["removedKeys"],
        json!([note.id])
    );
    assert!(engine.store.get(&note.id).is_none());
    assert!(view.cache_refresh(&engine).is_empty());
    Ok(())
}
#[test]
fn a_deleted_context_before_first_open_is_positive_removal_evidence() -> Result {
    let key = generate_secret_key();
    let note = event(&key, 1, 1, vec![]);
    let mut source = Engine::new();
    source.store.insert(note.clone(), None);
    let context = Context::capture(&source.store, &note.id, 1)?.expect("context");
    let raw = merge_contexts(
        None,
        &[context],
        &[Record::verified(&deletion(&key, &note.id))?],
        &"1".repeat(64),
        Limits::default(),
    )?;
    let mut engine = Engine::new();
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    let mut view = session();
    hold(
        &mut view,
        &engine,
        json!([{"key":"held-note","id":note.id}]),
    )?;
    assert!(engine.store.get(&note.id).is_none());
    assert_eq!(
        serde_json::to_value(&view.cache_refresh(&engine)[0])?["removedKeys"],
        json!(["held-note"])
    );
    Ok(())
}
#[test]
fn profile_and_embedded_note_removals_preserve_the_notification_row() -> Result {
    let key = generate_secret_key();
    let other = generate_secret_key();
    let profile = event(&key, 0, 1, vec![]);
    let note = event(&key, 1, 1, vec![]);
    let mut engine = Engine::new();
    engine.store.insert(profile.clone(), None);
    engine.store.insert(note.clone(), None);
    engine.store.insert(deletion(&other, &note.id), None);
    let mut view = session();
    hold(
        &mut view,
        &engine,
        json!([{"key":"notification", "profiles":[{"pubkey":profile.pubkey,"id":profile.id}],"quotes":[{"id":note.id}]}]),
    )?;
    assert!(view.cache_refresh(&engine).is_empty());
    engine.store.insert(deletion(&key, &profile.id), None);
    engine.store.insert(deletion(&key, &note.id), None);
    let out = serde_json::to_value(&view.cache_refresh(&engine)[0])?;
    assert_eq!(out["removedKeys"], json!([]));
    assert_eq!(out["invalidProfileIds"], json!([profile.id]));
    assert_eq!(out["removedQuoteIds"], json!([note.id]));
    Ok(())
}
#[test]
fn unknown_or_evicted_rows_remain_unknown_and_hints_are_bounded_and_released() -> Result {
    let engine = Engine::new();
    let mut view = session();
    let rows: Vec<_> = (0..100).map(|n| json!({"key":format!("k{n}"),"id":format!("{n:064x}"),"profiles":[{"pubkey":"bad","id":"bad"}]})).collect();
    hold(&mut view, &engine, json!(rows))?;
    assert_eq!(view.cache_held["view"].rows.len(), 64);
    assert_eq!(view.cache_missing_ids(&engine).len(), 32);
    assert!(view.cache_refresh(&engine).is_empty());
    let ids = view.cache_missing_ids(&engine);
    view.cache_mark_loaded(&ids);
    assert_eq!(view.cache_unresolved_ids(&engine)[0].1.len(), 32);
    view.input(
        serde_json::from_value(json!({"t":"close","sub":"view"}))?,
        &engine,
    )
    .map_err(|(_, e)| e)?;
    assert!(view.cache_held.is_empty());
    Ok(())
}
#[test]
fn unsupported_and_private_projection_hints_never_become_public_lookups() -> Result {
    let engine = Engine::new();
    let mut view = session();
    view.queries.get_mut("view").expect("query").source = "messages".into();
    hold(
        &mut view,
        &engine,
        json!([{"key":"private","id":"1".repeat(64)}]),
    )?;
    assert!(view.cache_missing_ids(&engine).is_empty());
    assert!(view.cache_held.is_empty());
    Ok(())
}

#[test]
fn private_policy_revocation_releases_held_public_lookups() -> Result {
    let key = generate_secret_key();
    let note = event(&key, 1, 1, vec![]);
    let policy = event(&key, 10000, 2, vec![]);
    let mut engine = Engine::new();
    engine.store.insert(policy.clone(), None);
    let mut view = session();
    view.queries.get_mut("view").expect("query").account = Some(policy.pubkey.clone());
    hold(&mut view, &engine, json!([{"key":note.id,"id":note.id}]))?;
    assert_eq!(view.cache_missing_ids(&engine), vec![note.id]);
    engine.private_lists.insert(
        policy.id,
        vec![vec!["word".into(), "secret selection".into()]],
    );
    assert!(view.cache_refresh(&engine).is_empty());
    assert!(view.cache_held.is_empty());
    assert!(view.cache_missing_ids(&engine).is_empty());
    Ok(())
}
