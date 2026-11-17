//! A new public filter policy is not a durable count basis until its write commits.
use super::*;
use crate::cache::context::{Context, Limits, merge_contexts, read_contexts};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
#[test]
fn uncommitted_public_policy_keeps_live_counts_out_of_the_durable_snapshot() -> Result {
    let key = generate_secret_key();
    let note = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            content: "public note".into(),
            tags: vec![],
        },
        &key,
    )
    .map_err(|_| "public fixture signing failed")?;
    let policy = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 2,
            kind: 10000,
            content: String::new(),
            tags: vec![],
        },
        &key,
    )
    .map_err(|_| "public fixture signing failed")?;
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    let context = Context::capture(&engine.store, &note.id, 100)?.ok_or("missing note")?;
    let raw = merge_contexts(None, &[context], &[], &"1".repeat(64), Limits::default())?;
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    let mut row = json!({"kind":"note","id":note.id,"counts":{}});
    settle(&mut row, &engine, None);
    assert_eq!(row["counts"]["context"]["current"], true);
    engine.pending.push(policy.clone(), true);
    settle(&mut row, &engine, None);
    assert_eq!(row["counts"]["context"]["restored"], true);
    assert_eq!(row["counts"]["context"]["current"], false);
    let batch = engine.pending.batch();
    engine.pending.push(policy, true);
    assert!(engine.pending.public_policy_pending());
    engine.pending.committed(&batch);
    settle(&mut row, &engine, None);
    assert_eq!(row["counts"]["context"]["current"], true);
    Ok(())
}
