//! A corrupt journal cannot poison writes, reuse old authority or allocate every context at once.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::{
    cache::context::{CONTEXT_BYTES, CONTEXT_RECORDS, Limits, read_contexts, recover_contexts},
    engine::{
        Engine,
        protocol::{Input, Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::generate_secret_key;
use support::*;

#[test]
fn a_corrupt_journal_is_repaired_under_an_unrelated_lineage() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(10);
    store.insert(note.clone(), None);
    let original = capture(&store, &note.id, 100);
    let raw = merge(None, std::slice::from_ref(&original), &[])?;
    let old = read_contexts(Some(&raw))?.remove(0);
    let mut corrupt: serde_json::Value = serde_json::from_str(&raw)?;
    corrupt["contexts"][0]["rows"][0]["raw"] = "not an event".into();
    let corrupt = corrupt.to_string();
    assert!(read_contexts(Some(&corrupt)).is_err());
    let repaired = recover_contexts(
        Some(&corrupt),
        &[original],
        &[],
        &"1".repeat(64),
        Limits::default(),
    )?;
    let new = read_contexts(Some(&repaired))?.remove(0);
    assert_ne!(old.lineage, new.lineage);
    assert_ne!(old.token, new.token);
    assert_eq!(new.rows.len(), 1);
    assert!(
        recover_contexts(Some(&corrupt), &[], &[], "invalid epoch", Limits::default()).is_err()
    );
    let again = recover_contexts(
        Some(&repaired),
        &[],
        &[],
        &"2".repeat(64),
        Limits::default(),
    )?;
    assert_eq!(read_contexts(Some(&again))?[0].lineage, new.lineage);
    Ok(())
}

#[test]
fn queued_contexts_respect_the_global_budget_before_transaction_clones() -> Result {
    let key = generate_secret_key();
    let mut engine = Engine::new();
    let mut recent = String::new();
    for index in 0..64 {
        let note = event(&key, 1, index + 1, &"read this ".repeat(100), vec![]);
        recent = note.id.clone();
        engine.store.insert(note.clone(), None);
        let sub = format!("read-{index}");
        engine.input(
            Input::Open {
                sub: sub.clone(),
                query: Query {
                    source: Source::Thread,
                    target: Some(note.id.clone()),
                    ..Default::default()
                },
            },
            100_000 + index,
        );
        engine.input(
            Input::CacheRead {
                sub,
                ids: vec![note.id],
            },
            100_000 + index,
        );
    }
    let batch = engine.read_contexts.batch_with_limits(
        &engine.store,
        &engine.zaps.receipts,
        Limits {
            targets: 256,
            records: 8000,
            bytes: 16 * 1024,
        },
    );
    assert!(
        !batch.contexts.is_empty() && batch.contexts.len() < 64,
        "contexts={}, pending={}, retained={}",
        batch.contexts.len(),
        engine.read_contexts.pending(),
        engine.store.len()
    );
    assert_eq!(batch.contexts[0].target, recent);
    assert!(batch.contexts.iter().map(|c| c.rows.len()).sum::<usize>() <= CONTEXT_RECORDS);
    assert!(serde_json::to_vec(&batch.contexts)?.len() <= 16 * 1024);
    let raw = merge(None, &batch.contexts, &[])?;
    assert!(raw.len() <= CONTEXT_BYTES);
    assert_eq!(read_contexts(Some(&raw))?.len(), batch.contexts.len());
    Ok(())
}
