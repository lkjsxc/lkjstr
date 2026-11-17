//! Public event bodies do not authorize caching a private-derived read selection.
use super::*;
use crate::engine::{protocol, wire::queries};
use serde_json::json;
use std::collections::BTreeSet;
type Result = std::result::Result<(), Box<dyn std::error::Error>>;

fn session() -> Session {
    let mut session = Session::default();
    session.queries.insert(
        "read".into(),
        queries::Query {
            source: "global".into(),
            ..Default::default()
        },
    );
    session.delivered.insert(
        "read".into(),
        vec![json!({"kind":"note","id":"a".repeat(64),"key":"note-key"})],
    );
    session
}
fn selected(inputs: &[protocol::Input]) -> Vec<String> {
    inputs
        .iter()
        .filter_map(|input| match input {
            protocol::Input::CacheRead { ids, .. } => Some(ids.clone()),
            _ => None,
        })
        .flatten()
        .collect()
}
#[test]
fn context_selection_requires_a_delivered_public_note_and_preserves_reading_input() -> Result {
    let engine = Engine::new();
    let mut session = session();
    let inputs = session
        .input(
            serde_json::from_value(json!({"t":"reading","sub":"read","key":"note-key"}))?,
            &engine,
        )
        .map_err(|(_, error)| error)?;
    assert_eq!(selected(&inputs), vec!["a".repeat(64)]);
    assert!(
        matches!(&inputs[0], protocol::Input::Reading { id: Some(id), .. } if id == &"a".repeat(64))
    );
    assert!(
        session
            .cache_read_inputs("unknown", &["a".repeat(64)], &engine)
            .is_empty()
    );
    assert!(
        session
            .cache_read_inputs("read", &["b".repeat(64)], &engine)
            .is_empty()
    );
    assert!(
        session
            .cache_read_inputs("read", &["not-an-id".into()], &engine)
            .is_empty()
    );
    Ok(())
}
#[test]
fn hidden_rows_and_invisible_views_do_not_become_durable_read_contexts() {
    let engine = Engine::new();
    let mut session = session();
    session.preview_hidden = true;
    assert!(
        session
            .cache_read_inputs("read", &["a".repeat(64)], &engine)
            .is_empty()
    );
    session.preview_hidden = false;
    session.timeline_visible = Some(BTreeSet::new());
    assert!(
        session
            .cache_read_inputs("read", &["a".repeat(64)], &engine)
            .is_empty()
    );
    session.timeline_visible = None;
    if let Some(rows) = session.delivered.get_mut("read") {
        rows[0]["hidden"] = json!({"reason":"mute"});
    }
    assert!(
        session
            .cache_read_inputs("read", &["a".repeat(64)], &engine)
            .is_empty()
    );
}
#[test]
fn an_account_with_private_membership_uses_the_same_public_projection_fence() -> Result {
    let key = lkjstr_protocol::generate_secret_key();
    let event = lkjstr_protocol::finalize_event(
        &lkjstr_protocol::EventTemplate {
            pubkey: None,
            kind: 10000,
            created_at: 1,
            tags: vec![],
            content: "ciphertext fixture".into(),
        },
        &key,
    )
    .map_err(|_| "public fixture signing failed")?;
    let mut engine = Engine::new();
    engine.private_lists.insert(
        event.id.clone(),
        vec![vec!["word".into(), "private selection".into()]],
    );
    engine.store.insert(event.clone(), None);
    let mut session = session();
    if let Some(query) = session.queries.get_mut("read") {
        query.account = Some(event.pubkey);
    }
    assert!(
        session
            .cache_read_inputs("read", &["a".repeat(64)], &engine)
            .is_empty()
    );
    engine.private_lists.clear();
    assert_eq!(
        selected(&session.cache_read_inputs("read", &["a".repeat(64)], &engine)),
        vec!["a".repeat(64)]
    );
    if let Some(query) = session.queries.get_mut("read") {
        query.source = "messages".into();
    }
    assert!(
        session
            .cache_read_inputs("read", &["a".repeat(64)], &engine)
            .is_empty()
    );
    Ok(())
}
#[test]
fn near_selection_is_bounded_before_any_context_is_written() {
    let engine = Engine::new();
    let session = session();
    assert_eq!(
        selected(&session.cache_read_inputs("read", &vec!["a".repeat(64); 1000], &engine)).len(),
        32
    );
}
