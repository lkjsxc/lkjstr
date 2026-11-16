#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{Engine, dm, protocol::Query};
use serde_json::{Value, json};
use std::collections::BTreeMap;
const NOW: u64 = 1_000_000;

fn ready(kind: u64) -> (Engine, String, Value) {
    let mut engine = Engine::new();
    engine.network.configure(vec![RELAY.into()], NOW);
    engine
        .network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":64}}"#);
    let list = event(800, 10050, "", vec![vec!["relay".into(), RELAY.into()]]);
    let account = list.pubkey.clone();
    engine.enqueue(RELAY.into(), list);
    engine.tick(NOW + 1);
    let (member, filter) = if kind == 1059 {
        (
            format!("~dm:{account}"),
            dm::routing::inbox_filter(&account, None),
        )
    } else {
        (
            format!("~dm-legacy:{account}"),
            lkjstr_protocol::NostrFilter {
                kinds: Some(vec![4]),
                tags: BTreeMap::from([("p".into(), vec![account.clone()])]),
                limit: Some(200),
                ..Default::default()
            },
        )
    };
    engine.set_dm_wants(vec![(member, filter, Query::default())], NOW + 2);
    engine.network.connected(RELAY, NOW + 3);
    let req = frames(&mut engine)
        .into_iter()
        .find(|f| {
            f[0] == "REQ"
                && f.as_array()
                    .is_some_and(|f| f.iter().skip(2).any(|f| f["kinds"][0] == kind))
        })
        .expect("private request");
    (engine, account, req)
}
fn receive(engine: &mut Engine, req: &Value, event: lkjstr_protocol::NostrEvent, at: u64) {
    let accepted = engine
        .network
        .message(RELAY, &json!(["EVENT", req[1], event]).to_string(), at)
        .expect("request accepts fixture before verification");
    engine.enqueue(RELAY.into(), accepted);
}
fn eose(engine: &mut Engine, req: &Value, at: u64) {
    engine
        .network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), at);
}
fn page(engine: &mut Engine, account: &str, req: &Value, kind: u64, count: usize) {
    for index in 0..count {
        receive(
            engine,
            req,
            event(
                900 - index as u64 / 4,
                kind,
                &format!("encrypted fixture {index}"),
                vec![vec!["p".into(), account.into()]],
            ),
            NOW + 10 + index as u64,
        );
    }
    eose(engine, req, NOW + 80);
}
#[test]
fn full_private_page_waits_for_every_verification_slice_before_advancing() {
    let (mut engine, account, req) = ready(1059);
    page(&mut engine, &account, &req, 1059, 64);
    let mut cursors = BTreeMap::new();
    assert!(
        !engine.dm_older(&account, &mut cursors),
        "raw EOSE is not acquired private history"
    );
    engine.tick(NOW + 100);
    assert!(
        !engine.dm_older(&account, &mut cursors),
        "one 32-event slice must not advance a 64-envelope page"
    );
    engine.tick(NOW + 101);
    assert!(engine.dm_older(&account, &mut cursors));
    assert_eq!(cursors.get(&(account.clone(), RELAY.into())), Some(&885));
    assert_eq!(engine.verified, 65);
}
#[test]
fn short_private_page_is_not_empty_or_exhausted_before_verification() {
    let (mut engine, account, req) = ready(1059);
    page(&mut engine, &account, &req, 1059, 1);
    assert!(
        engine.dm_history_more(&account, &BTreeMap::new()),
        "a short unverified page cannot prove the private history ended"
    );
    assert_eq!(engine.dm_phase(&account), ("loading", None));
    engine.tick(NOW + 100);
    assert!(!engine.dm_history_more(&account, &BTreeMap::new()));
    assert_eq!(engine.dm_phase(&account), ("live", None));
}
#[test]
fn old_format_private_history_obeys_the_same_verification_barrier() {
    let (mut engine, account, req) = ready(4);
    page(&mut engine, &account, &req, 4, 64);
    let mut cursors = BTreeMap::new();
    assert!(!engine.dm_older(&account, &mut cursors));
    engine.tick(NOW + 100);
    assert!(!engine.dm_older(&account, &mut cursors));
    engine.tick(NOW + 101);
    assert!(engine.dm_older(&account, &mut cursors));
    assert_eq!(cursors.get(&(account, "legacy".into())), Some(&885));
}
#[test]
fn unrelated_public_and_other_account_traffic_do_not_hold_private_history() {
    let (mut engine, account, req) = ready(1059);
    page(&mut engine, &account, &req, 1059, 64);
    engine.tick(NOW + 100);
    engine.tick(NOW + 101);
    engine.enqueue(RELAY.into(), event(900, 1, "unrelated public note", vec![]));
    engine.enqueue(
        RELAY.into(),
        event(
            900,
            1059,
            "other account wrapper",
            vec![vec!["p".into(), "a".repeat(64)]],
        ),
    );
    assert!(engine.network.verifying);
    let mut cursors = BTreeMap::new();
    assert!(engine.dm_older(&account, &mut cursors));
    assert_eq!(engine.dm_phase(&account), ("live", None));
}
