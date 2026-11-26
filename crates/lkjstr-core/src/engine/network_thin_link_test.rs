#![allow(clippy::expect_used)]
use super::*;
use crate::{optimizer::link::Hint, store::Store};
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
pub(super) const NOW: u64 = 200_000;
pub(super) const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const C: &str = "wss://c.test/";

pub(super) fn frames(network: &mut Network) -> Vec<(String, Value)> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) => Some((url, serde_json::from_str(&text).expect("frame"))),
            _ => None,
        })
        .collect()
}

pub(super) fn signed(at: u64, content: &str) -> lkjstr_protocol::NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: content.into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}

pub(super) fn setup(hint: bool) -> (Network, Store, NostrFilter, Value) {
    let store = Store::new(100);
    let query = Query::default();
    let filter = crate::engine::query::filter(&store, &query);
    let mut network = Network::default();
    if hint {
        network.optimizer.link.set_hint(Some(Hint::VeryThin));
    }
    network.configure(vec![A.into()], NOW);
    network.plan(vec![("feed".into(), filter.clone(), query)], &store, NOW);
    network.connected(A, NOW + 10);
    let frame = frames(&mut network)
        .into_iter()
        .find(|(_, frame)| frame[0] == "REQ")
        .expect("first request")
        .1;
    (network, store, filter, frame)
}

#[test]
fn two_routes_wait_for_the_thin_link_rtt_before_hedging_or_demotion() {
    let mut engine = crate::engine::Engine::new();
    engine.input(
        crate::engine::protocol::Input::LinkHint {
            hint: Some(Hint::VeryThin),
        },
        NOW,
    );
    engine.input(
        crate::engine::protocol::Input::Configure {
            relays: vec![A.into(), B.into(), C.into()],
        },
        NOW,
    );
    engine.input(
        crate::engine::protocol::Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        NOW,
    );
    let connects: Vec<_> = engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|e| {
            if let Effect::Connect(url) = e {
                Some(url)
            } else {
                None
            }
        })
        .collect();
    assert_eq!(connects, [A, B]);
    engine.network.connected(A, NOW + 10);
    engine.network.connected(B, NOW + 10);
    assert!(
        frames(&mut engine.network)
            .iter()
            .all(|(_, frame)| frame[2]["limit"] == 8)
    );
    for at in [400, 1_500, 2_999] {
        engine.tick(NOW + at);
        assert!(
            !engine
                .network
                .drain_effects()
                .iter()
                .any(|e| matches!(e, Effect::Connect(_)))
        );
    }
    engine.tick(NOW + 3_000);
    assert!(
        engine
            .network
            .drain_effects()
            .iter()
            .any(|e| matches!(e, Effect::Connect(url) if url == C))
    );
    assert_eq!(engine.network.soft_first_event_bound(), 4_500);
}

#[test]
fn asked_quota_and_full_tied_frontier_survive_link_changes() {
    let (mut network, mut store, filter, initial) = setup(true);
    assert_eq!(initial[2]["limit"], 8);
    network.optimizer.link.set_hint(None);
    network.close_group(A, initial[1].as_str().expect("wire"));
    network.tick(NOW + 220);
    let repeated = frames(&mut network)
        .into_iter()
        .find(|(_, frame)| frame[0] == "REQ")
        .expect("resumed quota")
        .1;
    assert_eq!(repeated[2]["limit"], 8);
    for index in 0..8 {
        let note = signed(190 - index / 2, &format!("row-{index}"));
        let accepted = network
            .message(
                A,
                &json!(["EVENT", repeated[1], note]).to_string(),
                NOW + 250,
            )
            .expect("matching signed event");
        network.event(A, &accepted, NOW + 251);
        store.insert(accepted, Some(A));
    }
    network.message(A, &json!(["EOSE", repeated[1]]).to_string(), NOW + 260);
    assert_eq!(network.page_cursor(&filter), Some(187));
    assert!(
        !network.page_exhausted(&filter),
        "the full eight-row page is not absence"
    );
    let next = NostrFilter {
        until: Some(187),
        ..filter.clone()
    };
    network.optimizer.link.set_hint(Some(Hint::VeryThin));
    network.plan(
        vec![("feed".into(), next.clone(), Query::default())],
        &store,
        NOW + 400,
    );
    network.tick(NOW + 500);
    let continuation = frames(&mut network)
        .into_iter()
        .find(|(_, frame)| frame[0] == "REQ" && frame[2]["until"] == 187)
        .expect("inclusive tied continuation")
        .1;
    assert_eq!(continuation[2]["limit"], 200);
    assert!(!network.page_exhausted(&next));
}

#[test]
fn existing_wire_hint_reaches_the_bounded_core_prior() {
    let mut engine = crate::engine::Engine::new();
    let mut session = crate::engine::wire::Session::default();
    for (effective, limit) in [("2g", 8), ("3g", 20), ("4g", 200), ("unknown", 200)] {
        let input = serde_json::from_value(json!({"t":"hint","hint":{
            "visibleSubs":[],"focusedSub":null,"pageHidden":false,"effectiveType":effective
        }}))
        .expect("wire hint");
        for input in session.input(input, &engine).expect("translated hint") {
            let encoded = serde_json::to_value(&input).expect("serializable core hint");
            let decoded = serde_json::from_value(encoded).expect("core hint round trip");
            engine.input(decoded, NOW);
        }
        assert_eq!(
            engine
                .network
                .optimizer
                .decide_plan(Default::default(), &[])
                .limit,
            limit
        );
        assert_eq!(engine.network.optimizer.link.state().samples, 0);
    }
}

#[path = "network_thin_quotas_test.rs"]
mod quotas;

#[path = "network_thin_hedge_test.rs"]
mod hedge;
