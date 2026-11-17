//! Retained signed deletion evidence outlives a full ordinary tombstone index.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::{
    cache::{Record, context::read_contexts},
    engine::Engine,
    store::{Inserted, Store},
};
use lkjstr_protocol::generate_secret_key;
use support::*;

#[test]
fn deleting_a_retained_fence_and_filling_tombstones_cannot_revive_its_contributor() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let reaction = related(&key, &note, 7, 2);
    let mut source = Store::new(100);
    source.insert(note.clone(), None);
    source.insert(reaction.clone(), None);
    let journal = merge(None, &[capture(&source, &note.id, 100)], &[])?;
    let fence = event(&key, 5, 3, "", vec![vec!["e".into(), reaction.id.clone()]]);
    let delete_fence = event(&key, 5, 4, "", vec![vec!["e".into(), fence.id.clone()]]);
    let corrected = merge(Some(&journal), &[], &[Record::verified(&fence)?])?;
    let corrected = merge(Some(&corrected), &[], &[Record::verified(&delete_fence)?])?;
    let mut engine = Engine::new();
    let full = event(
        &key,
        5,
        5,
        "",
        (0..4096)
            .map(|id| vec!["e".into(), format!("{id:064x}")])
            .collect(),
    );
    engine.store.insert(full, None);
    engine.restore_contexts(read_contexts(Some(&corrected))?)?;
    assert_eq!(
        engine.store.insert(reaction.clone(), None),
        Inserted::Deleted
    );
    assert!(engine.store.get(&reaction.id).is_none());
    assert_eq!(engine.store.counts(&note.id).2, 0);
    let evidence = engine
        .read_contexts
        .evidence(&engine.store, &engine.zaps.receipts, &note.id)
        .ok_or("missing context")?;
    assert!(evidence.restored && evidence.current);
    Ok(())
}
