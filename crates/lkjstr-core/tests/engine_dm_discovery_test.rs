#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, event, frames};
use lkjstr_core::engine::{Engine, dm, protocol::Query};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

fn configured(account: &str) -> Engine {
    let mut engine = Engine::new();
    engine.network.configure(vec![RELAY.into()], 0);
    engine.network.relay_information(
        RELAY,
        r#"{"limitation":{"max_subscriptions":1,"max_filters":1}}"#,
    );
    engine.set_dm_wants(
        dm::routing::wants(
            &engine.store,
            &BTreeSet::from([account.into()]),
            &BTreeSet::new(),
            &BTreeMap::new(),
        ),
        0,
    );
    engine.network.connected(RELAY, 1);
    engine
}
fn is_discovery(frame: &Value) -> bool {
    frame[2]["kinds"] == json!([10050])
}
#[test]
fn confirmed_missing_inbox_survives_live_slot_rotation() {
    let account = "11".repeat(32);
    let mut engine = configured(&account);
    let mut known = false;
    let mut served = BTreeSet::new();
    for now in (100..=5000).step_by(100) {
        for frame in frames(&mut engine) {
            if frame[0] != "REQ" {
                continue;
            }
            served.insert(frame[2].to_string());
            engine
                .network
                .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now);
            known |= is_discovery(&frame);
        }
        engine.tick(now);
        if known {
            assert_eq!(
                engine.dm_phase(&account),
                ("unsupported", Some("not-found")),
                "rotating a completed empty inbox lookup must preserve its evidence at {now}"
            );
        }
    }
    assert!(known);
    assert_eq!(
        served.len(),
        3,
        "discovery and both legacy reads still rotate"
    );
}
#[test]
fn unanswered_discovery_is_not_proven_absent_by_other_private_eose() {
    let account = "22".repeat(32);
    let mut engine = configured(&account);
    let mut asked = false;
    for now in (100..=5000).step_by(100) {
        for frame in frames(&mut engine) {
            if frame[0] != "REQ" {
                continue;
            }
            if is_discovery(&frame) {
                asked = true;
            } else {
                engine
                    .network
                    .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now);
            }
        }
        engine.tick(now);
        assert_eq!(engine.dm_phase(&account), ("loading", None));
    }
    assert!(asked);
}
#[test]
fn new_verified_advertisement_replaces_confirmed_absence() {
    let advertised = event(10, 10050, "", vec![vec!["relay".into(), RELAY.into()]]);
    let account = advertised.pubkey.clone();
    let mut engine = Engine::new();
    engine.network.configure(vec![RELAY.into()], 0);
    engine.set_dm_wants(
        vec![(
            format!("~dm-list:{account}"),
            dm::routing::discovery(&account),
            Query::default(),
        )],
        0,
    );
    engine.network.connected(RELAY, 1);
    let req = frames(&mut engine)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("discovery");
    engine
        .network
        .message(RELAY, &json!(["EOSE", req[1]]).to_string(), 10);
    assert_eq!(
        engine.dm_phase(&account),
        ("unsupported", Some("not-found"))
    );
    let received = engine
        .network
        .message(RELAY, &json!(["EVENT", req[1], advertised]).to_string(), 20)
        .expect("live advertisement after empty EOSE");
    engine.enqueue(RELAY.into(), received);
    assert_eq!(
        engine.dm_phase(&account),
        ("loading", None),
        "wait for signature verification"
    );
    engine.tick(30);
    assert_eq!(
        dm::routing::inboxes(&engine.store, &account),
        Ok(vec![RELAY.into()])
    );
    assert_ne!(
        engine.dm_phase(&account),
        ("unsupported", Some("not-found"))
    );
}
