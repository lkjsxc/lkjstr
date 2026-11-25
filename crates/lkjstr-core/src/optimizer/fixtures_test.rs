#![allow(clippy::expect_used)]
use super::{
    features::{Features, Interaction, Route, Timing},
    link::{Link, LinkState},
    plan_policy::decide,
};
use crate::store::{Inserted, Store};
use lkjstr_protocol::{NostrEvent, NostrFilter};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn event(n: u64, author: u64, kind: u64, size: usize) -> NostrEvent {
    NostrEvent {
        id: format!("{n:064x}"),
        pubkey: format!("{author:064x}"),
        kind,
        created_at: n,
        content: "x".repeat(size),
        tags: Vec::new(),
        sig: "0".repeat(128),
    }
}

pub(super) fn trim(store: &mut Store, held: &BTreeSet<String>, readers: &[u64]) {
    let authors: BTreeSet<_> = readers.iter().map(|n| format!("{n:064x}")).collect();
    let weights = store.retention_weights(|event| {
        if authors.contains(&event.pubkey) {
            64
        } else {
            1
        }
    });
    store.trim_weighted(
        &authors,
        held,
        &weights,
        &BTreeMap::new(),
        LinkState::default(),
    );
}

#[test]
fn caps_keep_open_threads_and_small_weighted_notes_through_spam() {
    let mut store = Store::with_caps(60, 10)
        .weight_retention()
        .with_byte_cap(50_000);
    let mut held = BTreeSet::new();
    for n in 1..=16 {
        let note = event(n, 1, 1, 90);
        if n <= 8 {
            held.insert(note.id.clone());
        }
        store.insert_deferred(note, None);
    }
    let own = event(200, 1, 10002, 0);
    store.insert_deferred(own.clone(), None);
    for batch in 1..=8 {
        for i in 0..32 {
            store.insert_deferred(event(300 + batch * 32 + i, 2, 1, 2_000), None);
        }
        trim(&mut store, &held, &[1]);
    }
    assert!(held.iter().all(|id| store.get(id).is_some()));
    assert!(store.get(&event(16, 1, 1, 90).id).is_some());
    assert!(store.get(&own.id).is_some());
    assert!(store.payload_bytes() <= 47_500);
    assert!(store.evictions() > 200);
}

#[test]
fn weight_eviction_leaves_an_inclusive_fence_and_refetch_counts_only_wire_hits() {
    let mut store = Store::with_caps(4, 4).weight_retention();
    let note = event(3, 2, 1, 4_000);
    for n in [1, 2, 4, 5] {
        store.insert_deferred(event(n, 1, 1, 16), None);
    }
    store.insert_deferred(note.clone(), None);
    trim(&mut store, &BTreeSet::new(), &[1]);
    let gap = NostrFilter {
        since: Some(3),
        until: Some(3),
        authors: Some(vec![note.pubkey.clone()]),
        kinds: Some(vec![1]),
        ..Default::default()
    };
    assert_eq!(store.eviction_gap(&gap), Some(3));
    assert_eq!(store.ghost_hits(), 0);
    store.insert_deferred(note, Some("wss://fixture.invalid"));
    assert_eq!(store.ghost_hits(), 1);
    assert_eq!(store.eviction_gap(&gap), None);
}

#[test]
fn deletion_of_deletion_and_late_original_keep_the_original_fence() {
    let mut store = Store::with_caps(4, 4).weight_retention();
    let target = event(1, 2, 1, 30);
    let mut deletion = event(2, 2, 5, 0);
    deletion.tags.push(vec!["e".into(), target.id.clone()]);
    store.insert_deferred(target.clone(), None);
    store.insert_deferred(deletion.clone(), None);
    for n in 3..9 {
        store.insert_deferred(event(n, 1, 1, 8), None);
    }
    trim(&mut store, &BTreeSet::new(), &[1]);
    assert!(store.get(&deletion.id).is_some());
    let mut second = event(9, 2, 5, 0);
    second.tags.push(vec!["e".into(), deletion.id.clone()]);
    store.insert_deferred(second, None);
    assert!(store.get(&deletion.id).is_none());
    assert_eq!(store.insert_deferred(target, None), Inserted::Deleted);
}

#[test]
fn own_addressable_slots_keep_only_the_newest_by_identifier() {
    let mut store = Store::with_caps(4, 4).weight_retention();
    let with_d = |n, d: &str| {
        let mut e = event(n, 1, 30030, 0);
        e.tags.push(vec!["d".into(), d.to_owned()]);
        e
    };
    store.insert_deferred(with_d(7, "a"), None);
    assert_eq!(store.insert_deferred(with_d(1, "a"), None), Inserted::Stale);
    assert_eq!(
        store.insert_deferred(with_d(8, "a"), None),
        Inserted::Replaced
    );
    store.insert_deferred(with_d(9, "b"), None);
    for n in 30..42 {
        store.insert_deferred(event(n, 2, 0, 100), None);
    }
    trim(&mut store, &BTreeSet::new(), &[1]);
    assert!(store.get(&with_d(8, "a").id).is_some());
    assert!(store.get(&with_d(9, "b").id).is_some());
    assert!(store.get(&with_d(7, "a").id).is_none());
}

#[test]
fn link_ignores_idle_and_repeated_buckets_and_planner_respects_clamps() {
    let mut link = Link::default();
    for second in 1..=4 {
        link.observe_bucket(second, 160_000, true);
        link.observe_bucket(second, 10_000, true);
    }
    assert_eq!(link.state().samples, 4);
    assert!(link.state().saturated);
    let routes = [
        Route {
            index: 0,
            useful_per_mille: Some(990),
            ..Default::default()
        },
        Route {
            index: 1,
            useful_per_mille: Some(980),
            cooldown: true,
            ..Default::default()
        },
        Route {
            index: 2,
            useful_per_mille: Some(950),
            online: true,
            ..Default::default()
        },
    ];
    let plan = decide(Features::default(), link.state(), &routes, true);
    assert_eq!(plan.fanout, 1);
    assert_eq!(plan.limit, 36);
    assert_eq!(plan.hedge_delay_ms, 400);
    assert_eq!(plan.hedge_target, Some(2));
    assert_eq!(plan.author_chunk, 200);
    assert_eq!(plan.prefetch_depth, 0);
    for second in 5..=7 {
        link.observe_bucket(second, 160_000, false);
    }
    assert!(!link.state().saturated);
    assert_eq!(link.state().throughput_bps, 160_000);
    let f = Features {
        interaction: Interaction::new(Some(100.5), None, Some(18.0)),
        ..Default::default()
    };
    assert_eq!(
        decide(f, LinkState::default(), &routes, true).prefetch_depth,
        0
    );
    let mut timing = Timing::default();
    for sample in 1..=16 {
        timing.observe(sample * 100);
    }
    assert_eq!(timing.p75(), Some(1200));
}

#[test]
fn address_deletion_is_owner_and_timestamp_scoped_across_retention() {
    let mut store = Store::with_caps(4, 4).weight_retention();
    let make = |id, author| {
        let mut note = event(id, author, 30030, 20);
        note.tags.push(vec!["d".into(), "set".into()]);
        note
    };
    let older = make(1, 1);
    store.insert_deferred(older.clone(), None);
    let target = format!("30030:{}:set", older.pubkey);
    let mut unrelated = event(2, 2, 5, 0);
    unrelated.tags.push(vec!["a".into(), target.clone()]);
    store.insert_deferred(unrelated, None);
    assert!(store.get(&older.id).is_some());

    let mut deletion = event(3, 1, 5, 0);
    deletion.tags.push(vec!["a".into(), target]);
    store.insert_deferred(deletion.clone(), None);
    for n in 8..20 {
        store.insert_deferred(event(n, 2, 1, 170), None);
    }
    trim(&mut store, &BTreeSet::new(), &[1]);
    assert!(store.get(&deletion.id).is_some());
    assert_eq!(store.insert_deferred(older, None), Inserted::Deleted);
    assert_eq!(store.insert_deferred(make(4, 1), None), Inserted::New);
}
