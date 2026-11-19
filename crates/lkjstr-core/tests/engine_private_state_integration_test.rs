#![allow(clippy::unwrap_used)]
// Private signer and zap discovery completions preserve the observed relay state.
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::engine::{
    Engine,
    private_lists::Access,
    protocol as p,
    wire::{Input, Output, Session},
    zaps::Failure,
};
use lkjstr_nips::list_crypto;
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn open(session: &mut Session, engine: &Engine, account: &str) {
    session
        .input(
            serde_json::from_value::<Input>(json!({
                "t":"open","sub":"notice","visible":true,
                "query":{"source":"notifications","account":account,"privateLists":true}
            }))
            .unwrap(),
            engine,
        )
        .unwrap();
}
fn fixture() -> (Engine, Session) {
    let (mut store, providers, target) = setup();
    store.insert(
        receipt(&prepared(&store, &providers, &target, 100), 110),
        None,
    );
    store.insert(
        event(
            2,
            10000,
            vec![],
            &list_crypto::encrypt(&[], &key(2), &[5; 32]).unwrap(),
            100,
        ),
        None,
    );
    let mut engine = Engine::new();
    engine.store = store;
    engine.network.now = 120_000;
    let mut session = Session::default();
    let account = key(2).public_key();
    open(&mut session, &engine, &account);
    engine.private_reads.sync(
        &engine.store,
        [(
            account,
            Access {
                authority: 1,
                local: false,
                error: None,
            },
        )]
        .into(),
        session.private_demands(1, &engine, &BTreeSet::new()),
        0,
    );
    (engine, session)
}
fn states(messages: Vec<Output>) -> Vec<Value> {
    messages
        .into_iter()
        .filter_map(|message| match message {
            Output::State { state, .. } => Some(state),
            _ => None,
        })
        .collect()
}
fn network(session: &mut Session, engine: &Engine, asked: usize, answered: usize) -> Value {
    states(session.output(
        p::Output::Status {
            sub: "notice".into(),
            state: "data".into(),
            asked_relays: asked,
            answered_relays: answered,
        },
        engine,
    ))
    .remove(0)
}
fn fresh(session: &mut Session, engine: &Engine) -> Vec<Value> {
    states(session.output(
        p::Output::Fresh {
            sub: "notice".into(),
            count: 0,
            own_head: false,
        },
        engine,
    ))
}
fn fail_provider(engine: &mut Engine) {
    let job = engine
        .zaps
        .providers
        .sync(&engine.store, &[key(2).public_key()], 120)
        .unwrap()
        .fetch
        .remove(0);
    assert!(
        engine
            .zaps
            .providers
            .complete(&engine.store, &job, Err(Failure::Network), 120)
    );
}
fn finish_private(engine: &mut Engine, ok: bool) {
    let job = engine.private_reads.next(&engine.store, 0).unwrap();
    engine.private_reads.finish(
        &engine.store,
        &job,
        if ok {
            Ok("[]".into())
        } else {
            Err("signer-refused")
        },
        1,
        true,
    );
}
fn check(state: &Value, private: &str, zap: &str, asked: usize, answered: usize) {
    assert_eq!(state["phase"], "live");
    assert_eq!(state["relaysAsked"], asked);
    assert_eq!(state["relaysAnswered"], answered);
    assert_eq!(state["privateLists"]["phase"], private);
    assert_eq!(state["zapEvidence"]["phase"], zap);
}
#[test]
fn private_completion_does_not_invent_a_relay_state() {
    let (mut engine, mut session) = fixture();
    assert!(
        states(session.output(
            p::Output::Rows {
                sub: "notice".into(),
                items: vec![],
                at_top: true,
                at_bottom: false,
            },
            &engine
        ))
        .is_empty()
    );
    assert!(session.private_tick(&engine).is_empty());
    finish_private(&mut engine, true);
    assert!(session.private_tick(&engine).is_empty());
    check(
        &network(&mut session, &engine, 2, 1),
        "ready",
        "loading",
        2,
        1,
    );
}
#[test]
fn private_completion_uses_current_zap_evidence_without_an_intervening_network_message() {
    let (mut engine, mut session) = fixture();
    check(
        &network(&mut session, &engine, 2, 1),
        "loading",
        "loading",
        2,
        1,
    );
    fail_provider(&mut engine);
    finish_private(&mut engine, true);
    let emitted = states(session.private_tick(&engine));
    assert_eq!(emitted.len(), 1);
    check(&emitted[0], "ready", "failed", 2, 1);
    assert!(session.private_tick(&engine).is_empty());
    assert!(fresh(&mut session, &engine).is_empty());
}
#[test]
fn zap_and_network_updates_preserve_the_current_private_completion() {
    let (mut engine, mut session) = fixture();
    check(
        &network(&mut session, &engine, 2, 1),
        "loading",
        "loading",
        2,
        1,
    );
    finish_private(&mut engine, false);
    check(
        &states(session.private_tick(&engine))[0],
        "failed",
        "loading",
        2,
        1,
    );
    fail_provider(&mut engine);
    check(&fresh(&mut session, &engine)[0], "failed", "failed", 2, 1);
    check(
        &network(&mut session, &engine, 3, 2),
        "failed",
        "failed",
        3,
        2,
    );
    engine.private_reads.retry(&key(2).public_key());
    finish_private(&mut engine, true);
    check(
        &states(session.private_tick(&engine))[0],
        "ready",
        "failed",
        3,
        2,
    );
    assert!(fresh(&mut session, &engine).is_empty());
}
#[test]
fn query_replacement_cannot_reuse_the_previous_accounts_relay_state() {
    let (engine, mut session) = fixture();
    check(
        &network(&mut session, &engine, 2, 1),
        "loading",
        "loading",
        2,
        1,
    );
    open(&mut session, &engine, &key(3).public_key());
    assert!(session.private_tick(&engine).is_empty());
    assert!(fresh(&mut session, &engine).is_empty());
    check(
        &network(&mut session, &engine, 1, 0),
        "ready",
        "ready",
        1,
        0,
    );
    session
        .input(
            Input::Close {
                sub: "notice".into(),
            },
            &engine,
        )
        .unwrap();
    assert!(session.private_tick(&engine).is_empty());
}
