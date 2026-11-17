//! Provider completion must survive acknowledgement of a first, pending context batch.
#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::{
    cache::context::{Limits, merge_contexts, read_contexts},
    engine::{
        Engine,
        protocol::{Input, Query, Source},
        zaps::*,
    },
};

#[test]
fn first_commit_ack_keeps_a_late_provider_verdict_dirty() {
    let (mut store, providers, target) = setup();
    let Target::Event { id } = &target else {
        unreachable!()
    };
    let raw = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(raw.clone(), None);
    let mut engine = Engine::new();
    engine.store = store;
    engine
        .zaps
        .receipts
        .sync(
            &engine.store,
            &Providers::default(),
            std::slice::from_ref(&raw.id),
            120,
        )
        .unwrap();
    engine.input(
        Input::Open {
            sub: "read".into(),
            query: Query {
                source: Source::Thread,
                target: Some(id.clone()),
                ..Default::default()
            },
        },
        120_000,
    );
    engine.input(
        Input::CacheRead {
            sub: "read".into(),
            ids: vec![id.clone()],
        },
        120_000,
    );
    let first = engine
        .read_contexts
        .batch(&engine.store, &engine.zaps.receipts);
    assert!(first.contexts[0].zaps[0].pending());
    let persisted = merge_contexts(
        None,
        &first.contexts,
        &[],
        &"1".repeat(64),
        Limits::default(),
    )
    .unwrap();
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
    engine
        .read_contexts
        .receipts_changed(engine.zaps.receipts.revision());
    engine
        .contexts_committed(&first, Some(read_contexts(Some(&persisted)).unwrap()))
        .unwrap();
    assert!(
        engine.read_contexts.pending(),
        "a first-context acknowledgement must retain the later verdict"
    );
    let second = engine
        .read_contexts
        .batch(&engine.store, &engine.zaps.receipts);
    assert!(!second.contexts[0].zaps[0].pending());
    let next = merge_contexts(
        Some(&persisted),
        &second.contexts,
        &[],
        &"2".repeat(64),
        Limits::default(),
    )
    .unwrap();
    engine
        .contexts_committed(&second, Some(read_contexts(Some(&next)).unwrap()))
        .unwrap();
    assert!(!engine.read_contexts.pending());
    let mut reopen = Engine::new();
    reopen
        .restore_contexts(read_contexts(Some(&next)).unwrap())
        .unwrap();
    let total = reopen
        .zaps
        .receipts
        .total(&reopen.store, &reopen.zaps.providers, &target, 800);
    assert_eq!((total.sats, total.phase), (21, Phase::Ready));
}
