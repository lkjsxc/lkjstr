#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::engine::{
    Engine, protocol as p,
    wire::{Input, Session},
    zaps::Failure,
};
use serde_json::{Value, json};

fn open(session: &mut Session, engine: &Engine, account: Option<String>) -> Vec<p::Input> {
    session
        .input(
            serde_json::from_value::<Input>(json!({
                "t":"open","sub":"notices","query":{"source":"notifications","account":account}
            }))
            .unwrap(),
            engine,
        )
        .unwrap()
}
fn fixture() -> (Engine, Session) {
    let (mut store, providers, target) = setup();
    store.insert(
        receipt(&prepared(&store, &providers, &target, 100), 110),
        None,
    );
    let mut engine = Engine::new();
    engine.store = store;
    engine.network.now = 120_000;
    let mut session = Session::default();
    open(&mut session, &engine, Some(key(2).public_key()));
    (engine, session)
}
fn output(session: &mut Session, engine: &Engine, input: p::Output) -> Vec<Value> {
    session
        .output(input, engine)
        .into_iter()
        .map(|message| serde_json::to_value(message).unwrap())
        .collect()
}
fn rows() -> p::Output {
    p::Output::Rows {
        sub: "notices".into(),
        items: vec![],
        at_top: true,
        at_bottom: false,
    }
}
fn fresh() -> p::Output {
    p::Output::Fresh {
        sub: "notices".into(),
        count: 0,
    }
}
fn states(messages: &[Value]) -> Vec<&Value> {
    messages
        .iter()
        .filter(|message| message["t"] == "state")
        .map(|message| &message["state"])
        .collect()
}
#[test]
fn unresolved_receipts_do_not_create_signed_out_notification_demand_or_state() {
    let (mut engine, mut session) = fixture();
    for input in open(&mut session, &engine, None) {
        engine.input(input, 120_000);
    }
    engine.tick(120_000);
    let messages: Vec<_> = engine
        .drain()
        .into_iter()
        .flat_map(|input| output(&mut session, &engine, input))
        .collect();
    let states = states(&messages);
    assert!(!states.is_empty());
    for state in states {
        assert_eq!(state["phase"], "done");
        assert_eq!(state["relaysAsked"], 0);
        assert_eq!(state["relaysAnswered"], 0);
        assert!(state.get("zapEvidence").is_none());
    }
    assert!(engine.zaps.effects().providers.is_empty());
    assert!(engine.network.drain_effects().is_empty());
}
#[test]
fn zap_evidence_waits_for_and_preserves_authoritative_network_state() {
    let (mut engine, mut session) = fixture();
    assert!(states(&output(&mut session, &engine, rows())).is_empty());
    let messages = output(
        &mut session,
        &engine,
        p::Output::Status {
            sub: "notices".into(),
            state: "data".into(),
            asked_relays: 2,
            answered_relays: 1,
        },
    );
    let state = states(&messages)[0];
    assert_eq!(state["phase"], "live");
    assert_eq!(state["zapEvidence"]["phase"], "loading");
    assert_eq!(state["zapEvidence"]["unverified"], 1);
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
    let messages = output(&mut session, &engine, fresh());
    let state = states(&messages)[0];
    assert_eq!(state["phase"], "live");
    assert_eq!(state["relaysAsked"], 2);
    assert_eq!(state["relaysAnswered"], 1);
    assert_eq!(state["zapEvidence"]["phase"], "failed");
    assert_eq!(state["zapEvidence"]["unverified"], 1);
    assert!(states(&output(&mut session, &engine, fresh())).is_empty());
    open(&mut session, &engine, Some(key(3).public_key()));
    assert!(states(&output(&mut session, &engine, rows())).is_empty());
}
