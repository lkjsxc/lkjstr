#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::engine::{Engine, accounts::Accounts, wire};
fn seen(engine: &mut Engine, account: &str) {
    let mark = wire::notification_read_mark(engine, account);
    let saved = Accounts {
        seen: std::collections::BTreeMap::from([(account.into(), mark.at)]),
        notification_ties: std::collections::BTreeMap::from([(account.into(), mark.ties)]),
        notification_zaps: std::collections::BTreeMap::from([(account.into(), mark.zaps)]),
        ..Default::default()
    };
    let restored: Accounts = serde_json::from_str(&serde_json::to_string(&saved).unwrap()).unwrap();
    engine.seen = restored.seen;
    engine.notification_ties = restored.notification_ties;
    engine.notification_zaps = restored.notification_zaps;
}
#[test]
fn older_candidate_becomes_unread_after_provider_recovery_even_after_newer_seen_and_reload() {
    let (mut store, providers, target) = setup();
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    let account = key(2).public_key();
    store.insert(event(3, 7, vec![tag(&["p", &account])], "+", 200), None);
    store.insert(raw.clone(), None);
    let mut engine = Engine::new();
    engine.store = store;
    engine.network.now = 210_000;
    assert_eq!(wire::unread_count(&engine, &account), 1);
    for _ in 0..2 {
        seen(&mut engine, &account);
    }
    assert_eq!(engine.seen[&account], 200_000);
    assert_eq!(wire::unread_count(&engine, &account), 0);
    assert_eq!(wire::unread_zap_evidence(&engine, &account).unverified, 1);
    engine.zaps.providers = providers;
    engine
        .zaps
        .receipts
        .sync(
            &engine.store,
            &engine.zaps.providers,
            std::slice::from_ref(&raw.id),
            210,
        )
        .unwrap();
    engine
        .zaps
        .receipts
        .advance(&engine.store, &engine.zaps.providers, 210, 4);
    assert_eq!(wire::unread_count(&engine, &account), 1);
    assert_eq!(wire::unread_zap_evidence(&engine, &account).unverified, 0);
    seen(&mut engine, &account);
    assert_eq!(wire::unread_count(&engine, &account), 0);
    assert_eq!(engine.notification_zaps[&account].deferred().count(), 0);
}
#[test]
fn changing_the_canonical_duplicate_preserves_unread_then_acknowledges_the_logical_payment() {
    let (mut store, providers, target) = setup();
    let first = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    let earlier = event(4, 9735, first.tags.clone(), "", 109);
    let earliest = event(4, 9735, first.tags.clone(), "", 108);
    let account = key(2).public_key();
    store.insert(event(3, 7, vec![tag(&["p", &account])], "+", 200), None);
    store.insert(first.clone(), None);
    let mut engine = Engine::new();
    engine.store = store;
    engine.network.now = 210_000;
    seen(&mut engine, &account);
    engine.store.insert(earlier.clone(), None);
    engine.zaps.providers = providers;
    let mut ids = vec![first.id.clone(), earlier.id.clone()];
    engine
        .zaps
        .receipts
        .sync(&engine.store, &engine.zaps.providers, &ids, 210)
        .unwrap();
    engine
        .zaps
        .receipts
        .advance(&engine.store, &engine.zaps.providers, 210, 4);
    assert!(engine.zaps.receipts.get(&engine.store, &first.id).is_none());
    assert!(
        engine
            .zaps
            .receipts
            .get(&engine.store, &earlier.id)
            .is_some()
    );
    assert_eq!(wire::unread_count(&engine, &account), 1);
    seen(&mut engine, &account);
    assert_eq!(wire::unread_count(&engine, &account), 0);
    assert_eq!(engine.notification_zaps[&account].deferred().count(), 0);
    ids.push(earliest.id.clone());
    engine.store.insert(earliest, None);
    engine
        .zaps
        .receipts
        .sync(&engine.store, &engine.zaps.providers, &ids, 211)
        .unwrap();
    engine
        .zaps
        .receipts
        .advance(&engine.store, &engine.zaps.providers, 211, 4);
    assert_eq!(wire::unread_count(&engine, &account), 0);
}

#[test]
fn canonical_receipt_eviction_does_not_recount_a_seen_payment_after_reload() {
    let mut store = lkjstr_core::store::Store::with_caps(2, 8);
    profile(&mut store, 2, "alice@ln.test", 1);
    let account = key(2).public_key();
    let target = lkjstr_core::engine::zaps::Target::Profile {
        pubkey: account.clone(),
    };
    let mut providers = lkjstr_core::engine::zaps::Providers::default();
    ready(&store, &mut providers, 2, 100);
    let first = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    let duplicate = event(4, 9735, first.tags.clone(), "", 111);
    let ids = vec![first.id.clone(), duplicate.id.clone()];
    store.insert(first.clone(), None);
    store.insert(duplicate.clone(), None);
    let mut engine = Engine::new();
    engine.store = store;
    engine.zaps.providers = providers;
    engine.network.now = 120_000;
    engine
        .zaps
        .receipts
        .sync(&engine.store, &engine.zaps.providers, &ids, 120)
        .unwrap();
    engine
        .zaps
        .receipts
        .advance(&engine.store, &engine.zaps.providers, 120, 4);
    assert_eq!(wire::unread_count(&engine, &account), 1);
    seen(&mut engine, &account);
    assert_eq!(engine.seen[&account], 110_000);
    assert_eq!(wire::unread_count(&engine, &account), 0);
    engine
        .store
        .insert(event(3, 1, vec![], "unrelated retained note", 121), None);
    assert!(engine.store.get(&first.id).is_none());
    assert!(engine.store.get(&duplicate.id).is_some());
    engine
        .zaps
        .receipts
        .sync(&engine.store, &engine.zaps.providers, &ids, 122)
        .unwrap();
    assert!(
        engine
            .zaps
            .receipts
            .get(&engine.store, &duplicate.id)
            .is_some()
    );
    assert_eq!(wire::unread_count(&engine, &account), 0);
}
