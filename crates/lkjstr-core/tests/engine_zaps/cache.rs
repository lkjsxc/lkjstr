#![allow(clippy::unwrap_used, clippy::panic)]
use super::common;
use common::*;
use lkjstr_core::engine::zaps::*;

fn load(
    cache: &mut Receipts,
    store: &lkjstr_core::store::Store,
    providers: &Providers,
    ids: &[String],
    now: u64,
) {
    cache.sync(store, providers, ids, now).unwrap();
    while cache.pending() > 0 {
        cache.advance(store, providers, now, 4);
    }
}
#[test]
fn duplicate_payment_hashes_never_count_twice_across_targets_or_arrival_order() {
    let (mut store, providers, first) = setup();
    let prepared_first = prepared(&store, &providers, &first, 100);
    let old = common::receipt(&prepared_first, 110);
    let later = common::receipt(&prepared_first, 111);
    let note = event(2, 1, vec![], "another target", 2);
    let second = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let cross = common::receipt(&prepared(&store, &providers, &second, 100), 112);
    let ids = vec![cross.id.clone(), later.id.clone(), old.id.clone()];
    for raw in [cross, later, old.clone()] {
        store.insert(raw, None);
    }
    let mut cache = Receipts::default();
    load(&mut cache, &store, &providers, &ids, 120);
    assert_eq!(cache.total(&store, &providers, &first, 120).sats, 21);
    assert_eq!(cache.total(&store, &providers, &second, 120).sats, 0);
    assert!(cache.get(&store, &old.id).is_some());
    assert_eq!(
        ids.iter()
            .filter(|id| cache.get(&store, id).is_some())
            .count(),
        1
    );
}
#[test]
fn the_same_payment_hash_for_another_recipient_has_a_separate_provider_attestation() {
    let (mut store, mut providers, first) = setup();
    let old = common::receipt(&prepared(&store, &providers, &first, 100), 110);
    profile(&mut store, 3, "bob@ln.test", 1);
    ready(&store, &mut providers, 3, 100);
    let note = event(3, 1, vec![], "other recipient", 1);
    let second = Target::Event {
        id: note.id.clone(),
    };
    store.insert(note, None);
    let other = common::receipt(&prepared(&store, &providers, &second, 100), 110);
    let ids = vec![old.id.clone(), other.id.clone()];
    store.insert(old, None);
    store.insert(other, None);
    let mut cache = Receipts::default();
    load(&mut cache, &store, &providers, &ids, 120);
    assert_eq!(cache.total(&store, &providers, &first, 120).sats, 21);
    assert_eq!(cache.total(&store, &providers, &second, 120).sats, 21);
}
#[test]
fn completed_historical_authorization_survives_ttl_and_profile_provider_rotation() {
    let (mut store, mut providers, target) = setup();
    let prepared = prepared(&store, &providers, &target, 100);
    let old = common::receipt(&prepared, 110);
    let ids = vec![old.id.clone()];
    store.insert(old, None);
    let mut cache = Receipts::default();
    load(&mut cache, &store, &providers, &ids, 120);
    assert_eq!(cache.total(&store, &providers, &target, 700).sats, 21);
    profile(&mut store, 2, "alice@other.test", 2);
    let job = providers
        .sync(&store, &[key(2).public_key()], 800)
        .unwrap()
        .fetch
        .remove(0);
    assert!(providers.complete(&store, &job, Ok(response(&job.binding, 5)), 800));
    load(&mut cache, &store, &providers, &ids, 800);
    let total = cache.total(&store, &providers, &target, 800);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (21, 0, Phase::Ready)
    );
    let proof = cache.get(&store, &ids[0]).unwrap();
    assert_eq!(proof.provider, key(4).public_key());
    assert_eq!(proof.provider_observed_at, 100);
    assert_eq!(proof.verified_at, 120);
    // A new receipt after the rotation has no completed historical authorization.
    let unseen = common::receipt(&prepared, 111);
    let both = vec![ids[0].clone(), unseen.id.clone()];
    store.insert(unseen, None);
    load(&mut cache, &store, &providers, &both, 801);
    let total = cache.total(&store, &providers, &target, 801);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (21, 1, Phase::Failed)
    );
}
#[test]
fn restart_does_not_fabricate_historical_http_authorization() {
    let (mut store, mut providers, target) = setup();
    let old = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    let ids = vec![old.id.clone()];
    store.insert(old, None);
    profile(&mut store, 2, "alice@other.test", 2);
    let job = providers
        .sync(&store, &[key(2).public_key()], 800)
        .unwrap()
        .fetch
        .remove(0);
    assert!(providers.complete(&store, &job, Ok(response(&job.binding, 5)), 800));
    let mut empty_session = Receipts::default();
    load(&mut empty_session, &store, &providers, &ids, 800);
    let total = empty_session.total(&store, &providers, &target, 800);
    assert_eq!(
        (total.sats, total.unverified, total.phase),
        (0, 1, Phase::Failed)
    );
}
#[test]
fn validation_budget_is_bounded_and_malformed_claims_never_supply_money() {
    let (mut store, providers, target) = setup();
    let prepared = prepared(&store, &providers, &target, 100);
    let mut ids = vec![];
    for at in 110..116 {
        let raw = common::receipt(&prepared, at);
        ids.push(raw.id.clone());
        store.insert(raw, None);
    }
    let mut cache = Receipts::default();
    cache.sync(&store, &providers, &ids, 120).unwrap();
    assert_eq!(cache.pending(), 6);
    cache.advance(&store, &providers, 120, usize::MAX);
    assert_eq!(cache.pending(), 2);
    cache.advance(&store, &providers, 120, 4);
    assert_eq!(cache.total(&store, &providers, &target, 120).sats, 21);
    let malformed = event(
        4,
        9735,
        vec![
            tag(&["p", &key(2).public_key()]),
            tag(&[
                "e",
                match &target {
                    Target::Event { id } => id,
                    _ => unreachable!(),
                },
            ]),
            tag(&["amount", "9000000000000000"]),
        ],
        "",
        120,
    );
    ids.push(malformed.id.clone());
    store.insert(malformed, None);
    load(&mut cache, &store, &providers, &ids, 120);
    assert_eq!(cache.total(&store, &providers, &target, 120).sats, 21);
}
