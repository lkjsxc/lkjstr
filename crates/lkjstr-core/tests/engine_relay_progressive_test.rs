#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    Engine,
    network::{Effect, Network},
    protocol::{Input, Output, Query},
};
use lkjstr_core::store::Store;
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
const NOW: u64 = 200_000;
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const C: &str = "wss://c.test/";

fn note(at: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: "A verified progressive fixture".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}
fn sends(network: &mut Network) -> Vec<(String, Value)> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) => Some((url, serde_json::from_str(&text).expect("frame"))),
            _ => None,
        })
        .collect()
}
fn filter() -> NostrFilter {
    NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(20),
        ..Default::default()
    }
}
fn setup(f: NostrFilter) -> Network {
    let mut network = Network::default();
    network.configure(vec![A.into(), B.into(), C.into()], NOW);
    network.plan(
        vec![("feed".into(), f, Query::default())],
        &Store::new(100),
        NOW,
    );
    network.drain_effects();
    network.connected(A, NOW + 10);
    network.connected(B, NOW + 10);
    network
}
fn wire(frames: &[(String, Value)], relay: &str) -> String {
    frames
        .iter()
        .find(|(url, f)| url == relay && f[0] == "REQ")
        .expect("route request")
        .1[1]
        .as_str()
        .expect("wire id")
        .into()
}
fn states(network: &mut Network) -> Vec<String> {
    network
        .drain_output()
        .into_iter()
        .filter_map(|out| match out {
            Output::Status { sub, state, .. } if sub == "feed" => Some(state),
            _ => None,
        })
        .collect()
}

#[test]
fn verified_partial_data_is_ready_at_300ms_without_any_eose() {
    let mut network = setup(filter());
    let frames = sends(&mut network);
    let event = note(190);
    let message = json!(["EVENT", wire(&frames, A), event]).to_string();
    let verified = network
        .message(A, &message, NOW + 50)
        .expect("matched event");
    network.event(A, &verified, NOW + 60);
    network.tick(NOW + 299);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 300);
    assert_eq!(states(&mut network), ["data"]);
    network.message(
        B,
        &json!(["CLOSED", wire(&frames, B), "unavailable"]).to_string(),
        NOW + 310,
    );
    network.tick(NOW + 5_000);
    assert!(states(&mut network).iter().all(|state| state == "data"));
}

#[test]
fn one_verified_delivered_page_is_ready_before_the_other_relays() {
    let mut network = setup(filter());
    let frames = sends(&mut network);
    network.event(A, &note(190), NOW + 50);
    network.message(A, &json!(["EOSE", wire(&frames, A)]).to_string(), NOW + 60);
    network.tick(NOW + 61);
    assert_eq!(states(&mut network), ["data"]);
    assert!(!network.page_exhausted(&filter()));
}

#[test]
fn engine_wakes_for_a_400ms_hedge_even_when_both_sockets_are_silent() {
    let mut engine = Engine::new();
    engine.input(
        Input::Configure {
            relays: vec![A.into(), B.into(), C.into()],
        },
        NOW,
    );
    engine.input(
        Input::Open {
            sub: "feed".into(),
            query: Query::default(),
        },
        NOW,
    );
    let connects: Vec<_> = engine
        .network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| {
            if let Effect::Connect(url) = effect {
                Some(url)
            } else {
                None
            }
        })
        .collect();
    assert_eq!(connects, [A, B]);
    engine.tick(NOW + 399);
    assert!(
        !engine
            .network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(_)))
    );
    engine.tick(NOW + 400);
    assert!(
        engine
            .network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == C))
    );
}

#[test]
fn a_useful_route_suppresses_the_speculative_third_route() {
    let mut network = setup(filter());
    sends(&mut network);
    network.event(A, &note(190), NOW + 50);
    network.plan(
        vec![("feed".into(), filter(), Query::default())],
        &Store::new(100),
        NOW + 400,
    );
    assert!(
        !network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Connect(url) if url == C))
    );
}

#[test]
fn completed_one_shot_closes_once_and_late_cancelled_frames_do_not_route() {
    let event = note(190);
    let f = NostrFilter {
        ids: Some(vec![event.id.clone()]),
        ..Default::default()
    };
    let mut network = setup(f);
    network.tick(NOW + 50);
    let frames = sends(&mut network);
    let id = wire(&frames, A);
    network.message(A, &json!(["EOSE", id]).to_string(), NOW + 80);
    network.message(A, &json!(["EOSE", id]).to_string(), NOW + 81);
    assert_eq!(
        sends(&mut network)
            .iter()
            .filter(|(_, frame)| frame[0] == "CLOSE" && frame[1] == id)
            .count(),
        1
    );
    assert!(
        network
            .message(A, &json!(["EVENT", id, event]).to_string(), NOW + 90)
            .is_none()
    );
}

#[test]
fn verified_first_event_and_eose_scores_survive_restart_without_session_uses() {
    let mut network = setup(filter());
    let frames = sends(&mut network);
    network.event(A, &note(190), NOW + 60);
    network.message(A, &json!(["EOSE", wire(&frames, A)]).to_string(), NOW + 210);
    assert_eq!(network.relays[A].first_event_ms, Some(50));
    assert_eq!(network.relays[A].latency_ms, Some(200));
    assert_eq!(network.relays[A].request_uses, 1);
    let saved = network.quality_json(NOW + 220);
    let mut restored = Network::default();
    restored.configure(vec![A.into()], NOW + 230);
    restored.restore_quality(&saved, NOW + 230);
    assert_eq!(restored.relays[A].first_event_ms, Some(50));
    assert_eq!(restored.relays[A].latency_ms, Some(200));
    assert_eq!(restored.relays[A].request_uses, 0);
}
