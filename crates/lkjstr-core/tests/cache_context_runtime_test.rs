//! Durable contributors authorize corrections; live partial stores never do.
#![allow(clippy::expect_used)]
#[path = "cache_context/support.rs"]
mod support;
use lkjstr_core::{
    cache::{Record, context::read_contexts},
    engine::{
        Engine,
        protocol::{Input, Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::{NostrEvent, generate_secret_key};
use support::*;

fn read(engine: &mut Engine, note: &NostrEvent, now: u64) {
    engine.input(
        Input::Open {
            sub: "read".into(),
            query: Query {
                source: Source::Thread,
                target: Some(note.id.clone()),
                ..Default::default()
            },
        },
        now,
    );
    engine.input(
        Input::CacheRead {
            sub: "read".into(),
            ids: vec![note.id.clone()],
        },
        now,
    );
}
fn evidence(engine: &Engine, id: &str) -> lkjstr_core::engine::cache::ContextEvidence {
    engine
        .read_contexts
        .evidence(&engine.store, &engine.zaps.receipts, id)
        .expect("committed evidence")
}

#[test]
fn a_missing_contributor_cannot_authorize_a_lower_cached_count() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    for at in 2..9 {
        store.insert(related(&key, &note, 7, at), None);
    }
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let mut engine = Engine::new();
    assert!(
        engine
            .read_contexts
            .evidence(&engine.store, &engine.zaps.receipts, &note.id)
            .is_none()
    );
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    assert_eq!(engine.store.counts(&note.id).2, 7);
    assert!(evidence(&engine, &note.id).restored && evidence(&engine, &note.id).current);
    engine.store = Store::new(100);
    engine.store.insert(note.clone(), None);
    let partial = evidence(&engine, &note.id);
    assert!(!partial.restored && !partial.current);
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    assert_eq!(engine.store.counts(&note.id).2, 7);
    assert!(evidence(&engine, &note.id).current);
    Ok(())
}

#[test]
fn late_commit_acknowledgement_cannot_bless_or_drop_new_live_contributors() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    read(&mut engine, &note, 100_000);
    let first = engine
        .read_contexts
        .batch(&engine.store, &engine.zaps.receipts);
    assert_eq!(first.contexts.len(), 1);
    let raw = merge(None, &first.contexts, &[])?;
    let reaction = related(&key, &note, 7, 2);
    engine.enqueue("fixture".into(), reaction);
    engine.tick(100_025);
    engine.contexts_committed(&first, Some(read_contexts(Some(&raw))?))?;
    let live = evidence(&engine, &note.id);
    assert!(live.restored && !live.current);
    assert!(engine.read_contexts.pending());
    assert_eq!(engine.store.counts(&note.id).2, 1);
    let second = engine
        .read_contexts
        .batch(&engine.store, &engine.zaps.receipts);
    let next = merge(Some(&raw), &second.contexts, &[])?;
    engine.contexts_committed(&second, Some(read_contexts(Some(&next))?))?;
    let committed = evidence(&engine, &note.id);
    assert!(committed.current);
    assert_eq!(committed.lineage, live.lineage);
    assert!(committed.generation.parse::<u64>()? > live.generation.parse::<u64>()?);
    assert!(!engine.read_contexts.pending());
    Ok(())
}

#[test]
fn a_signed_deletion_corrects_downward_without_mistaking_absence_for_authority() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let reaction = related(&key, &note, 7, 2);
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    engine.store.insert(reaction.clone(), None);
    let raw = merge(None, &[capture(&engine.store, &note.id, 100)], &[])?;
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    let old = evidence(&engine, &note.id);
    let deleted = event(&key, 5, 3, "", vec![vec!["e".into(), reaction.id.clone()]]);
    engine.enqueue("fixture".into(), deleted.clone());
    engine.tick(100_025);
    assert_eq!(engine.store.counts(&note.id).2, 0);
    let live = evidence(&engine, &note.id);
    assert!(live.restored && !live.current);
    assert_eq!(live.token, old.token);
    let batch = engine
        .read_contexts
        .batch(&engine.store, &engine.zaps.receipts);
    let next = merge(Some(&raw), &batch.contexts, &[Record::verified(&deleted)?])?;
    engine.contexts_committed(&batch, Some(read_contexts(Some(&next))?))?;
    let corrected = evidence(&engine, &note.id);
    assert!(corrected.current);
    assert_ne!(corrected.token, old.token);
    assert_eq!(corrected.lineage, old.lineage);
    let mut reopened = Engine::new();
    reopened.restore_contexts(read_contexts(Some(&next))?)?;
    assert_eq!(reopened.store.counts(&note.id).2, 0);
    assert!(evidence(&reopened, &note.id).current);
    Ok(())
}

#[test]
fn committed_old_contributors_are_a_bounded_floor_under_timestamp_eviction() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut source = Store::new(100);
    source.insert(note.clone(), None);
    for at in 2..9 {
        source.insert(related(&key, &note, 7, at), None);
    }
    let raw = merge(None, &[capture(&source, &note.id, 100)], &[])?;
    let mut engine = Engine::new();
    engine.store = Store::new(3);
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    for at in 100..120 {
        engine.store.insert(target(&key, at), None);
    }
    assert_eq!(engine.store.len(), 8);
    assert_eq!(engine.store.counts(&note.id).2, 7);
    assert!(evidence(&engine, &note.id).current);
    engine.restore_contexts(vec![])?;
    assert!(engine.store.len() <= 3);
    Ok(())
}

#[test]
fn generations_above_javascript_integer_precision_cross_as_exact_decimal_strings() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let mut journal: serde_json::Value = serde_json::from_str(&raw)?;
    journal["generation"] = serde_json::json!(9_007_199_254_740_992_u64);
    store.insert(related(&key, &note, 7, 2), None);
    let next = merge(
        Some(&journal.to_string()),
        &[capture(&store, &note.id, 200)],
        &[],
    )?;
    let mut engine = Engine::new();
    engine.restore_contexts(read_contexts(Some(&next))?)?;
    let wire = serde_json::to_value(evidence(&engine, &note.id))?;
    assert_eq!(wire["generation"], "9007199254740993");
    assert_eq!(wire["restored"], true);
    assert_eq!(wire["current"], true);
    Ok(())
}

#[test]
fn corrupt_restore_is_rejected_before_touching_the_live_store_or_authority() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut engine = Engine::new();
    engine.store.insert(note.clone(), None);
    let raw = merge(None, &[capture(&engine.store, &note.id, 100)], &[])?;
    engine.restore_contexts(read_contexts(Some(&raw))?)?;
    let old = evidence(&engine, &note.id);
    let mut corrupt = read_contexts(Some(&raw))?;
    corrupt[0].rows[0].raw.push('x');
    assert!(engine.restore_contexts(corrupt).is_err());
    assert_eq!(engine.store.len(), 1);
    assert_eq!(evidence(&engine, &note.id).token, old.token);
    Ok(())
}
