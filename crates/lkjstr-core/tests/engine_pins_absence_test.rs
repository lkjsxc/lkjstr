#![allow(clippy::expect_used)]
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::{Engine, network::Effect, protocol::Output};
use serde_json::Value;
use support::*;

fn routed(engine: &mut Engine) -> Vec<(String, Value)> {
    engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(relay, text) => Some((relay, serde_json::from_str(&text).expect("frame"))),
            _ => None,
        })
        .collect()
}

#[test]
fn one_empty_relay_does_not_prove_absence_while_another_owner_lookup_is_pending() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY, OTHER]);
    let own = event(1, 1, 10, "own", vec![]);
    engine.store.insert(own.clone(), None);
    // Device-account discovery independently covers both configured routes.
    engine.discover_account(Some(own.pubkey.clone()), vec![], NOW);
    let pending = request(&mut engine, "pin", &own.pubkey, &own.id, true);
    assert!(!pending.iter().any(|out| matches!(out, Output::Sign { .. })));
    engine.network.connected(RELAY, NOW + 1);
    engine.network.connected(OTHER, NOW + 1);
    let mut withheld = None;
    let mut empty = false;
    for step in 1..=20 {
        let now = NOW + step * 100;
        engine.tick(now);
        assert!(
            !engine
                .drain()
                .iter()
                .any(|out| matches!(out, Output::Sign { .. })),
            "an unanswered route cannot authorize overwriting an unknown list"
        );
        for (relay, frame) in routed(&mut engine)
            .into_iter()
            .filter(|(_, f)| f[0] == "REQ")
        {
            if frame[2]["kinds"] == serde_json::json!([10001]) {
                if relay == OTHER {
                    withheld = Some(frame);
                    continue;
                }
                empty = true;
            }
            eose(&mut engine, &relay, &frame, now + 1);
        }
    }
    assert!(empty, "first relay gave a complete empty pin-list answer");
    let withheld = withheld.expect("second relay pin-list lookup");
    assert!(
        !engine
            .network
            .list_loaded(&engine.store, &own.pubkey, 10001)
    );
    eose(&mut engine, OTHER, &withheld, NOW + 2001);
    engine.tick(NOW + 2100);
    let draft = unsigned(engine.drain());
    assert_eq!(draft.tags, vec![pin_tag(&own.id)]);
}
