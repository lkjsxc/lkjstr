#![allow(clippy::unwrap_used)]
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::engine::{
    Engine,
    wire::{Input, Session},
    zaps::Failure,
};
use serde_json::{Value, json};

fn open(e: &mut Engine, session: &mut Session, source: &str) {
    let input: Input = serde_json::from_value(json!({
        "t":"open","sub":source,"query":{"source":source,"account":key(2).public_key()}
    }))
    .unwrap();
    for input in session.input(input, e).unwrap() {
        e.input(input, 120_000);
    }
}
fn outputs(e: &mut Engine, session: &mut Session) -> Vec<Value> {
    e.drain()
        .into_iter()
        .flat_map(|o| session.output(o, e))
        .map(|o| serde_json::to_value(o).unwrap())
        .collect()
}
fn rows(messages: &[Value]) -> Vec<&Value> {
    let mut rows = vec![];
    for message in messages {
        if let Some(items) = message["rows"].as_array() {
            rows.extend(items);
        }
        if let Some(ops) = message["ops"].as_array() {
            for op in ops {
                if op["row"].is_object() {
                    rows.push(&op["row"]);
                }
                if let Some(items) = op["rows"].as_array() {
                    rows.extend(items);
                }
            }
        }
    }
    rows
}
#[test]
fn provider_authorized_amount_actor_and_unread_use_one_canonical_view() {
    let (mut store, providers, target) = setup();
    let request = prepared(&store, &providers, &target, 100);
    let receipt = common::receipt(&request, 110);
    let forged = event(5, 9735, receipt.tags.clone(), "", 111);
    let duplicate = event(4, 9735, receipt.tags.clone(), "", 112);
    for raw in [&receipt, &forged, &duplicate] {
        store.insert(raw.clone(), None);
    }
    let mut e = Engine::new();
    e.store = store;
    let mut session = Session::default();
    open(&mut e, &mut session, "global");
    open(&mut e, &mut session, "notifications");
    let initial = outputs(&mut e, &mut session);
    assert!(
        rows(&initial)
            .iter()
            .filter(|r| r["counts"].is_object())
            .all(|r| r["counts"]["zaps"] == 0)
    );
    assert_eq!(
        lkjstr_core::engine::wire::unread_count(&e, &key(2).public_key()),
        0
    );
    e.tick(120_000);
    let work = e.zaps.effects();
    assert_eq!(work.providers.len(), 1);
    let job = &work.providers[0];
    assert!(
        e.zaps
            .provider_response(&e.store, job, Ok(response(&job.binding, 4)), 120)
    );
    e.tick(120_100);
    let projected = outputs(&mut e, &mut session);
    let projected = rows(&projected);
    let id = match target {
        lkjstr_core::engine::zaps::Target::Event { id } => id,
        _ => unreachable!(),
    };
    let note = projected.iter().find(|r| r["id"] == id).unwrap();
    assert_eq!(note["counts"]["zaps"], 21);
    assert_eq!(note["counts"]["zapAmountMsat"], "21000");
    assert_eq!(note["counts"]["zapUnverified"], 1);
    assert_eq!(note["counts"]["zapState"], "failed");
    let notice = projected.iter().find(|r| r["type"] == "zap").unwrap();
    assert_eq!(notice["key"], receipt.id);
    assert_eq!(notice["actors"][0]["pubkey"], key(1).public_key());
    assert_eq!(notice["zapReceipt"]["verification"], "provider-authorized");
    assert!(
        projected
            .iter()
            .all(|r| r["key"] != forged.id && r["key"] != duplicate.id)
    );
    assert_eq!(
        lkjstr_core::engine::wire::unread_count(&e, &key(2).public_key()),
        1
    );
    let (at, ties) = lkjstr_core::engine::wire::notification_watermark(&e, &key(2).public_key());
    assert_eq!(at, 110_000);
    assert_eq!(ties.into_iter().collect::<Vec<_>>(), vec![receipt.id]);
}
#[test]
fn asynchronous_provider_failure_patches_a_quiet_visible_note_out_of_loading() {
    let (mut store, providers, target) = setup();
    let receipt = common::receipt(&prepared(&store, &providers, &target, 100), 110);
    store.insert(receipt, None);
    let mut e = Engine::new();
    e.store = store;
    let mut session = Session::default();
    open(&mut e, &mut session, "global");
    outputs(&mut e, &mut session);
    e.tick(120_000);
    let job = e.zaps.effects().providers.remove(0);
    let before = outputs(&mut e, &mut session);
    assert!(
        rows(&before)
            .iter()
            .any(|r| r["counts"]["zapState"] == "loading")
    );
    assert!(
        e.zaps
            .provider_response(&e.store, &job, Err(Failure::Network), 120)
    );
    e.tick(120_100);
    let after = outputs(&mut e, &mut session);
    assert!(
        rows(&after)
            .iter()
            .any(|r| r["counts"]["zapState"] == "failed")
    );
}
