//! Committed contributor sets can correct counts; a partial store cannot erase them.
#![allow(clippy::expect_used)]
use lkjstr_core::{
    cache::{
        Record,
        context::{Limits, merge_contexts, read_contexts},
    },
    engine::rows,
    store::Store,
};
use lkjstr_protocol::{SecretKeyBytes, generate_secret_key};

#[path = "cache_context/support.rs"]
mod support;
use support::*;

#[test]
fn old_contributors_restore_the_held_count_before_any_relay_or_tick() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    for at in 2..9 {
        store.insert(related(&key, &note, 7, at), None);
    }
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let contexts = read_contexts(Some(&raw))?;
    assert_eq!(contexts[0].generation, 1);
    assert!(!contexts[0].lineage.is_empty());
    let engine = restore(&raw);
    assert_eq!(engine.store.counts(&note.id).2, 7);
    assert_eq!(engine.verified, 0);
    assert!(engine.pending.is_empty());
    Ok(())
}

#[test]
fn a_stale_partial_writer_unions_contributors_instead_of_authorizing_a_lower_count() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut first = Store::new(100);
    first.insert(note.clone(), None);
    first.insert(related(&key, &note, 7, 2), None);
    let raw = merge(None, &[capture(&first, &note.id, 100)], &[])?;
    let before = read_contexts(Some(&raw))?.remove(0);
    let mut second = Store::new(100);
    second.insert(note.clone(), None);
    second.insert(related(&key, &note, 7, 3), None);
    let next = merge(Some(&raw), &[capture(&second, &note.id, 90)], &[])?;
    let after = read_contexts(Some(&next))?.remove(0);
    assert_eq!(restore(&next).store.counts(&note.id).2, 2);
    assert_eq!(after.lineage, before.lineage);
    assert!(after.generation > before.generation);
    assert_eq!(after.seen_at, 100);
    assert_ne!(after.token, before.token);
    Ok(())
}

#[test]
fn owner_signed_deletion_corrects_downward_and_a_late_writer_cannot_revive_it() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let reaction = related(&key, &note, 7, 2);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    store.insert(reaction.clone(), None);
    let original = capture(&store, &note.id, 100);
    let raw = merge(None, std::slice::from_ref(&original), &[])?;
    let first = read_contexts(Some(&raw))?.remove(0);
    let deletion = |owner: &SecretKeyBytes| {
        Record::verified(&event(
            owner,
            5,
            3,
            "",
            vec![vec!["e".into(), reaction.id.clone()]],
        ))
        .expect("deletion receipt")
    };
    let foreign = merge(Some(&raw), &[], &[deletion(&generate_secret_key())])?;
    assert_eq!(read_contexts(Some(&foreign))?[0].token, first.token);
    assert_eq!(restore(&foreign).store.counts(&note.id).2, 1);
    let deleted = merge(Some(&foreign), &[], &[deletion(&key)])?;
    let corrected = read_contexts(Some(&deleted))?.remove(0);
    assert_eq!(corrected.lineage, first.lineage);
    assert!(corrected.generation > first.generation);
    assert_eq!(restore(&deleted).store.counts(&note.id).2, 0);
    let stale = merge(Some(&deleted), &[original], &[])?;
    assert_eq!(read_contexts(Some(&stale))?[0].token, corrected.token);
    assert_eq!(restore(&stale).store.counts(&note.id).2, 0);
    Ok(())
}

#[test]
fn reply_grandchildren_without_root_tags_are_part_of_the_count_basis() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let reply = related(&key, &note, 1, 2);
    let child = related(&key, &reply, 1, 3);
    let mut store = Store::new(100);
    for event in [note.clone(), reply, child] {
        store.insert(event, None);
    }
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let engine = restore(&raw);
    assert_eq!(rows::row(&engine.store, &note, None, 0).counts.replies, 2);
    Ok(())
}

#[test]
fn evicted_and_recreated_contexts_have_unrelated_lineages() -> Result {
    let key = generate_secret_key();
    let first = target(&key, 1);
    let second = target(&key, 2);
    let mut store = Store::new(100);
    store.insert(first.clone(), None);
    store.insert(second.clone(), None);
    let limits = Limits {
        targets: 1,
        ..Limits::default()
    };
    let one = merge_contexts(
        None,
        &[capture(&store, &first.id, 100)],
        &[],
        &"1".repeat(64),
        limits,
    )?;
    let old = read_contexts(Some(&one))?.remove(0);
    let two = merge_contexts(
        Some(&one),
        &[capture(&store, &second.id, 200)],
        &[],
        &"2".repeat(64),
        limits,
    )?;
    assert_eq!(read_contexts(Some(&two))?[0].target, second.id);
    let three = merge_contexts(
        Some(&two),
        &[capture(&store, &first.id, 300)],
        &[],
        &"3".repeat(64),
        limits,
    )?;
    let fresh = read_contexts(Some(&three))?.remove(0);
    assert_ne!(fresh.lineage, old.lineage);
    assert!(fresh.generation > old.generation);
    Ok(())
}

#[test]
fn body_membership_or_generation_corruption_never_becomes_restore_evidence() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let original = read_contexts(Some(&raw))?.remove(0);
    let mut changed = original.clone();
    changed.generation += 1;
    assert!(changed.checked().is_err());
    let mut changed = original.clone();
    changed.rows[0].raw = changed.rows[0].raw.replace("read before", "changed");
    assert!(changed.checked().is_err());
    let mut changed = original;
    changed.rows.clear();
    assert!(changed.checked().is_err());
    assert!(merge(Some("{"), &[], &[]).is_err());
    Ok(())
}

#[test]
fn touching_only_recency_keeps_the_same_durable_count_generation() -> Result {
    let key = generate_secret_key();
    let note = target(&key, 1);
    let mut store = Store::new(100);
    store.insert(note.clone(), None);
    let raw = merge(None, &[capture(&store, &note.id, 100)], &[])?;
    let old = read_contexts(Some(&raw))?.remove(0);
    let next = merge(Some(&raw), &[capture(&store, &note.id, 200)], &[])?;
    let new = read_contexts(Some(&next))?.remove(0);
    assert_eq!(
        (new.lineage, new.generation, new.token),
        (old.lineage, old.generation, old.token)
    );
    assert_eq!(new.seen_at, 200);
    Ok(())
}

#[test]
fn budget_eviction_keeps_whole_contexts_and_never_truncates_a_count_basis() -> Result {
    let key = generate_secret_key();
    let small = target(&key, 1);
    let large = event(&key, 1, 2, &"payload".repeat(1000), vec![]);
    let mut store = Store::new(100);
    store.insert(small.clone(), None);
    store.insert(large.clone(), None);
    let raw = merge_contexts(
        None,
        &[
            capture(&store, &small.id, 100),
            capture(&store, &large.id, 200),
        ],
        &[],
        &"1".repeat(64),
        Limits {
            targets: 10,
            records: 2,
            bytes: 2000,
        },
    )?;
    let contexts = read_contexts(Some(&raw))?;
    assert!(raw.len() <= 2000);
    assert_eq!(contexts.len(), 1);
    assert_eq!(contexts[0].target, small.id);
    assert_eq!(contexts[0].rows.len(), 1);
    Ok(())
}
