//! Historical HTTP authorization and invoice deduplication survive a public cache restore.
#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::{
    cache::{
        context::{Context, Limits, merge_contexts, read_contexts},
        zaps::Decision,
    },
    engine::{Engine, zaps::*},
};

fn id(target: &Target) -> &str {
    match target {
        Target::Event { id } => id,
        Target::Profile { pubkey } => pubkey,
    }
}
fn restore(context: Context) -> Engine {
    let raw = merge_contexts(None, &[context], &[], &"1".repeat(64), Limits::default()).unwrap();
    let mut engine = Engine::new();
    engine
        .restore_contexts(read_contexts(Some(&raw)).unwrap())
        .unwrap();
    engine
}
fn checked_context(
    store: &lkjstr_core::store::Store,
    receipts: &Receipts,
    target: &Target,
) -> Context {
    let mut context = Context::capture(store, id(target), 100).unwrap().unwrap();
    receipts.checkpoint(store, &mut context).unwrap();
    context
}
fn load(store: &lkjstr_core::store::Store, providers: &Providers, ids: &[String]) -> Receipts {
    let mut receipts = Receipts::default();
    receipts.sync(store, providers, ids, 120).unwrap();
    while receipts.pending() > 0 {
        receipts.advance(store, providers, 120, 4);
    }
    receipts
}

#[test]
fn a_validated_historical_zap_restores_without_a_provider_or_network_answer() {
    let (mut store, providers, target) = setup();
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(raw.clone(), None);
    let receipts = load(&store, &providers, std::slice::from_ref(&raw.id));
    let context = checked_context(&store, &receipts, &target);
    assert_eq!(context.zaps.len(), 1);
    let engine = restore(context);
    assert!(
        engine
            .zaps
            .providers
            .get(&engine.store, &key(2).public_key(), 800)
            .is_none()
    );
    let total = engine
        .zaps
        .receipts
        .total(&engine.store, &engine.zaps.providers, &target, 800);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (21, 0, Phase::Ready)
    );
    let evidence = engine
        .read_contexts
        .evidence(&engine.store, &engine.zaps.receipts, id(&target))
        .unwrap();
    assert!(evidence.restored && evidence.current);
    assert_eq!(engine.verified, 0);
}

#[test]
fn signed_raw_receipts_without_prior_http_authorization_remain_unrestored() {
    let (mut store, providers, target) = setup();
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(raw, None);
    let context = Context::capture(&store, id(&target), 100).unwrap().unwrap();
    assert!(context.zaps.is_empty());
    let engine = restore(context);
    let total = engine
        .zaps
        .receipts
        .total(&engine.store, &engine.zaps.providers, &target, 800);
    assert_eq!(total.sats, 0);
    assert_eq!(total.unverified, 1);
    assert_ne!(total.phase, Phase::Ready);
    let evidence = engine
        .read_contexts
        .evidence(&engine.store, &engine.zaps.receipts, id(&target))
        .unwrap();
    assert!(!evidence.restored && !evidence.current);
}

#[test]
fn another_targets_canonical_payment_is_kept_so_a_cached_zero_does_not_inflate() {
    let (mut store, providers, first) = setup();
    let old = common::receipt(&prepared(&store, &providers, &first, 100), 110);
    let note = event(2, 1, vec![], "second target", 2);
    let second = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let duplicate = common::receipt(&prepared(&store, &providers, &second, 100), 112);
    store.insert(old.clone(), None);
    store.insert(duplicate.clone(), None);
    let receipts = load(&store, &providers, &[old.id.clone(), duplicate.id.clone()]);
    assert_eq!(receipts.total(&store, &providers, &second, 120).sats, 0);
    let context = checked_context(&store, &receipts, &second);
    assert!(context.rows.iter().any(|row| row.id == old.id));
    assert_eq!(context.zaps.len(), 2);
    let engine = restore(context);
    let total = engine
        .zaps
        .receipts
        .total(&engine.store, &engine.zaps.providers, &second, 800);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (0, 0, Phase::Ready)
    );
    assert!(
        engine
            .read_contexts
            .evidence(&engine.store, &engine.zaps.receipts, id(&second))
            .unwrap()
            .current
    );
}

#[test]
fn historical_authorization_corruption_cannot_change_a_stored_zap_amount() {
    let (mut store, providers, target) = setup();
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(raw.clone(), None);
    let receipts = load(&store, &providers, &[raw.id]);
    let mut context = checked_context(&store, &receipts, &target);
    if let Decision::Accepted { value } = &mut context.zaps[0].decision {
        value.amount_msat += 1000;
    }
    assert!(context.checked().is_err());
    assert!(merge_contexts(None, &[context], &[], &"1".repeat(64), Limits::default()).is_err());
}

#[test]
fn explicit_pending_state_restores_honestly_and_a_stale_writer_cannot_replace_completed_authorization()
 {
    let (mut store, providers, target) = setup();
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(raw.clone(), None);
    let mut pending = Receipts::default();
    pending
        .sync(
            &store,
            &Providers::default(),
            std::slice::from_ref(&raw.id),
            120,
        )
        .unwrap();
    let unresolved = checked_context(&store, &pending, &target);
    assert!(unresolved.zaps[0].pending());
    let journal = merge_contexts(
        None,
        std::slice::from_ref(&unresolved),
        &[],
        &"1".repeat(64),
        Limits::default(),
    )
    .unwrap();
    let mut engine = restore(unresolved.clone());
    let total = engine
        .zaps
        .receipts
        .total(&engine.store, &engine.zaps.providers, &target, 800);
    assert_eq!((total.sats, total.unverified), (0, 1));
    assert_ne!(total.phase, Phase::Ready);
    assert!(
        engine
            .read_contexts
            .evidence(&engine.store, &engine.zaps.receipts, id(&target))
            .unwrap()
            .current
    );
    engine.store.insert(
        (*store.replaceable(&key(2).public_key(), 0).unwrap()).clone(),
        None,
    );
    engine.zaps.providers = providers;
    engine
        .zaps
        .receipts
        .sync(
            &engine.store,
            &engine.zaps.providers,
            std::slice::from_ref(&raw.id),
            120,
        )
        .unwrap();
    engine
        .zaps
        .receipts
        .advance(&engine.store, &engine.zaps.providers, 120, 4);
    let live = engine
        .read_contexts
        .evidence(&engine.store, &engine.zaps.receipts, id(&target))
        .unwrap();
    assert!(live.restored && !live.current);
    let completed = checked_context(&engine.store, &engine.zaps.receipts, &target);
    let next = merge_contexts(
        Some(&journal),
        &[completed],
        &[],
        &"1".repeat(64),
        Limits::default(),
    )
    .unwrap();
    let committed = read_contexts(Some(&next)).unwrap().remove(0);
    assert!(!committed.zaps[0].pending());
    assert!(committed.generation > read_contexts(Some(&journal)).unwrap()[0].generation);
    let stale = merge_contexts(
        Some(&next),
        &[unresolved],
        &[],
        &"1".repeat(64),
        Limits::default(),
    )
    .unwrap();
    assert_eq!(
        read_contexts(Some(&stale)).unwrap()[0].token,
        committed.token
    );
    let mut reopened = Engine::new();
    reopened
        .restore_contexts(read_contexts(Some(&stale)).unwrap())
        .unwrap();
    let total =
        reopened
            .zaps
            .receipts
            .total(&reopened.store, &reopened.zaps.providers, &target, 800);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (21, 0, Phase::Ready)
    );
}
