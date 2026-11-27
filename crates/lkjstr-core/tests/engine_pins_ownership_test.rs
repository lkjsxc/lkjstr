#![allow(clippy::expect_used)]
#[path = "engine_pins/support.rs"]
mod support;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::json;
use support::*;

#[test]
fn shared_pin_watch_lives_until_both_profile_and_account_discovery_release_it() {
    let mut engine = Engine::new();
    configure(&mut engine, &[RELAY]);
    engine
        .network
        .relays
        .get_mut(RELAY)
        .expect("relay")
        .max_reqs = 8;
    let initial = event(1, 10001, 10, "", vec![]);
    let owner = initial.pubkey.clone();
    engine.discover_account(Some(owner.clone()), vec![], NOW);
    let mut session = Session::default();
    let open = json!({"t":"open","sub":"pins","query":{"source":"pins","pubkey":owner}});
    accept(&mut session, &mut engine, open.clone(), NOW);
    output(&mut session, &mut engine);
    engine.network.connected(RELAY, NOW + 1);
    let mut lookup = None;
    for step in 1..=10 {
        let now = NOW + step * 100;
        engine.tick(now);
        output(&mut session, &mut engine);
        for frame in frames(&mut engine).into_iter().filter(|f| f[0] == "REQ") {
            if frame[2]["kinds"] == json!([10001]) {
                assert!(
                    lookup.is_none(),
                    "shared owners must reuse the list request"
                );
                relay_event(&mut engine, RELAY, &frame, &initial, now + 1);
                lookup = Some(frame.clone());
            }
            eose(&mut engine, RELAY, &frame, now + 2);
        }
    }
    let lookup = lookup.expect("shared pin-list request");
    accept(
        &mut session,
        &mut engine,
        json!({"t":"close","sub":"pins"}),
        NOW + 1100,
    );
    assert!(
        !frames(&mut engine)
            .iter()
            .any(|f| *f == json!(["CLOSE", lookup[1]]))
    );
    let next = event(1, 10001, 20, "account still watches", vec![]);
    relay_event(&mut engine, RELAY, &lookup, &next, NOW + 1200);
    engine.tick(NOW + 1300);
    assert_eq!(
        engine.store.replaceable(&owner, 10001).expect("list").id,
        next.id
    );

    accept(&mut session, &mut engine, open, NOW + 1400);
    output(&mut session, &mut engine);
    engine.discover_account(None, vec![], NOW + 1500);
    assert!(
        !frames(&mut engine)
            .iter()
            .any(|f| *f == json!(["CLOSE", lookup[1]]))
    );
    let latest = event(1, 10001, 30, "profile still watches", vec![]);
    relay_event(&mut engine, RELAY, &lookup, &latest, NOW + 1600);
    engine.tick(NOW + 1700);
    assert_eq!(
        engine.store.replaceable(&owner, 10001).expect("list").id,
        latest.id
    );
    output(&mut session, &mut engine);
    frames(&mut engine);

    accept(
        &mut session,
        &mut engine,
        json!({"t":"close","sub":"pins"}),
        NOW + 1800,
    );
    assert!(
        frames(&mut engine)
            .iter()
            .any(|f| *f == json!(["CLOSE", lookup[1]]))
    );
    engine.tick(NOW + 1900);
    assert!(!frames(&mut engine).iter().any(|f| f[0] == "REQ"));
}
