//! Public mute counts change only with the committed policy that produced them.
#![allow(clippy::expect_used)]
use super::*;
use crate::cache::{
    Record,
    context::{Context, Limits, merge_contexts, read_contexts},
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
fn event(
    key: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: &str,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content: content.into(),
            tags,
        },
        key,
    )
    .expect("signed fixture")
}
fn project(engine: &Engine, note: &NostrEvent, account: &str) -> Value {
    let row = crate::engine::rows::row_with_lists(
        &engine.store,
        note,
        Some(account),
        0,
        &engine.private_lists,
    );
    let mut value = crate::engine::wire::note::note(&row, &engine.store, Some(account));
    settle(&mut value, engine, Some(account));
    value
}
fn contexts(engine: &mut Engine, note: &NostrEvent) -> Result {
    let context = Context::capture(&engine.store, &note.id, 100)?.ok_or("context")?;
    let raw = merge_contexts(None, &[context], &[], &"1".repeat(64), Limits::default())?;
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    Ok(())
}
#[test]
fn pending_mute_and_late_old_ack_never_bless_the_new_policy_count() -> Result {
    let owner = generate_secret_key();
    let actor = generate_secret_key();
    let note = event(&owner, 1, 1, "root", vec![]);
    let reply = event(
        &actor,
        1,
        2,
        "reply",
        vec![vec!["e".into(), note.id.clone(), "".into(), "reply".into()]],
    );
    let first = event(
        &owner,
        10000,
        3,
        "",
        vec![vec!["p".into(), reply.pubkey.clone()]],
    );
    let second = event(
        &owner,
        10000,
        4,
        "",
        vec![
            vec!["p".into(), reply.pubkey.clone()],
            vec!["word".into(), "blocked".into()],
        ],
    );
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    engine.store.insert(reply, None);
    contexts(&mut engine, &note)?;
    let before = project(&engine, &note, &note.pubkey);
    assert_eq!(before["counts"]["replies"], 1);
    assert_eq!(before["counts"]["context"]["selection"]["committed"], true);
    assert!(before["counts"]["context"]["selection"].get("id").is_none());
    engine.store.insert(first.clone(), None);
    engine.pending.push(first.clone(), true);
    let batch = engine.pending.batch();
    engine.store.insert(second.clone(), None);
    engine.pending.push(second.clone(), true);
    engine.public_policy_committed(&batch);
    engine.pending.committed(&batch);
    let pending = project(&engine, &note, &note.pubkey);
    assert_eq!(pending["counts"]["replies"], 0);
    assert_eq!(pending["counts"]["context"]["current"], false);
    assert_eq!(pending["counts"]["context"]["selection"]["id"], second.id);
    assert_eq!(
        pending["counts"]["context"]["selection"]["committed"],
        false
    );
    let batch = engine.pending.batch();
    engine.public_policy_committed(&batch);
    engine.pending.committed(&batch);
    engine.public_policy_committed(&[first]);
    let committed = project(&engine, &note, &note.pubkey);
    assert_eq!(committed["counts"]["context"]["current"], true);
    assert_eq!(
        committed["counts"]["context"]["selection"]["committed"],
        true
    );
    assert_eq!(
        committed["counts"]["context"]["selection"]["createdAt"],
        "4"
    );
    assert_eq!(
        committed["counts"]["context"]["token"],
        before["counts"]["context"]["token"]
    );
    assert_ne!(
        committed["counts"]["context"]["selection"]["token"],
        before["counts"]["context"]["selection"]["token"]
    );
    let unmute = event(&owner, 10000, 5, "", vec![]);
    engine.restore_cache(&[Record::verified(&unmute)?]);
    let changed = project(&engine, &note, &note.pubkey);
    assert_eq!(changed["counts"]["replies"], 1);
    assert_eq!(changed["counts"]["context"]["selection"]["id"], unmute.id);
    assert_eq!(changed["counts"]["context"]["current"], true);
    engine.forget_public_policy(&note.pubkey);
    assert_eq!(
        project(&engine, &note, &note.pubkey)["counts"]["context"]["current"],
        false
    );
    engine.restore_cache(&[Record::verified(&unmute)?]);
    assert_eq!(
        project(&engine, &note, &note.pubkey)["counts"]["context"]["current"],
        true
    );
    Ok(())
}
#[test]
fn restored_policy_keeps_exact_time_and_the_replaceable_tie_winner() -> Result {
    let key = generate_secret_key();
    let note = event(&key, 1, 1, "root", vec![]);
    let at = 9_007_199_254_740_993;
    let left = event(&key, 10000, at, "left", vec![]);
    let right = event(&key, 10000, at, "right", vec![]);
    let winner = left.id.clone().min(right.id.clone());
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    contexts(&mut engine, &note)?;
    engine.restore_cache(&[Record::verified(&left)?, Record::verified(&right)?]);
    let row = project(&engine, &note, &note.pubkey);
    let selection = &row["counts"]["context"]["selection"];
    assert_eq!(selection["id"], winner);
    assert_eq!(selection["createdAt"], "9007199254740993");
    assert_eq!(selection["account"], note.pubkey);
    assert_eq!(selection["committed"], true);
    assert_eq!(selection["token"].as_str().expect("token").len(), 64);
    Ok(())
}
