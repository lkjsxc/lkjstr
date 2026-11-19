#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Output, Query},
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
const NOW: u64 = 200_000;
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";

fn event() -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 190,
            kind: 1,
            content: "Delayed relay startup".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .expect("signed fixture")
}
fn plan(network: &mut Network, filter: NostrFilter, now: u64) {
    network.plan(
        vec![("feed".into(), filter, Query::default())],
        &Store::new(100),
        now,
    );
}
fn filter(event: &NostrEvent) -> NostrFilter {
    NostrFilter {
        ids: Some(vec![event.id.clone()]),
        ..Default::default()
    }
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
fn request(network: &mut Network, relay: &str) -> String {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) if url == relay => {
                let value: Value = serde_json::from_str(&text).expect("frame");
                (value[0] == "REQ").then(|| value[1].as_str().expect("id").to_owned())
            }
            _ => None,
        })
        .next()
        .expect("transmitted request")
}
fn receive(network: &mut Network, note: NostrEvent, now: u64) {
    let wire = request(network, A);
    let accepted = network
        .message(A, &json!(["EVENT", wire, note]).to_string(), now)
        .expect("current response");
    network.event(A, &accepted, now + 1);
    network.tick(now + 2);
}

#[test]
fn missing_bootstrap_is_neutral_until_the_ten_second_soft_bound() {
    let mut network = Network::default();
    let f = filter(&event());
    plan(&mut network, f.clone(), NOW);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 9_999);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 10_000);
    assert_eq!(states(&mut network), ["error"]);
    network.plan(vec![], &Store::new(100), NOW + 10_001);
    network.tick(NOW + 20_000);
    assert!(states(&mut network).is_empty());
    plan(&mut network, f, NOW + 20_001);
    assert!(
        states(&mut network).is_empty(),
        "a new owner gets a new wait"
    );
    network.tick(NOW + 30_001);
    assert_eq!(states(&mut network), ["error"]);
}

#[test]
fn delayed_configuration_and_seven_second_connection_do_not_flash_failure() {
    let mut network = Network::default();
    let note = event();
    plan(&mut network, filter(&note), NOW);
    network.configure(vec![A.into()], NOW + 250);
    plan(&mut network, filter(&note), NOW + 250);
    network.tick(NOW + 5_000);
    assert!(states(&mut network).is_empty());
    network.connected(A, NOW + 7_000);
    assert!(states(&mut network).is_empty());
    receive(&mut network, note, NOW + 7_010);
    assert_eq!(states(&mut network), ["data"]);
}

#[test]
fn zero_connection_soft_failure_does_not_cancel_a_late_request() {
    let mut network = Network::default();
    let note = event();
    network.configure(vec![A.into()], NOW);
    plan(&mut network, filter(&note), NOW);
    network.tick(NOW + 5_000);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 10_000);
    assert_eq!(states(&mut network), ["error"]);
    assert_eq!(network.relays[A].timeouts, 0, "no REQ was transmitted");
    assert!(
        !network
            .drain_effects()
            .iter()
            .any(|effect| matches!(effect, Effect::Disconnect(url) if url == A))
    );
    network.connected(A, NOW + 11_000);
    assert_eq!(states(&mut network), ["pending"]);
    receive(&mut network, note, NOW + 11_010);
    assert_eq!(states(&mut network), ["data"]);
}

#[test]
fn transmitted_public_requests_keep_the_five_second_response_deadline() {
    let mut network = Network::default();
    network.configure(vec![A.into()], NOW);
    plan(&mut network, filter(&event()), NOW);
    network.connected(A, NOW + 100);
    let wire = request(&mut network, A);
    network.tick(NOW + 5_099);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 5_100);
    assert_eq!(states(&mut network), ["error"]);
    assert_eq!(network.relays[A].timeouts, 1);
    assert!(network.drain_effects().iter().any(|effect| {
        matches!(effect, Effect::Send(url, text) if url == A
            && serde_json::from_str::<Value>(text).expect("frame") == json!(["CLOSE", wire]))
    }));
}

#[test]
fn another_pending_connection_prevents_failure_until_it_definitively_fails() {
    let mut network = Network::default();
    network.configure(vec![A.into(), B.into()], NOW);
    plan(&mut network, filter(&event()), NOW);
    network.connected(A, NOW + 100);
    request(&mut network, A);
    network.tick(NOW + 5_100);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 10_000);
    assert!(
        states(&mut network).is_empty(),
        "one connection was established"
    );
    network.disconnected(B, NOW + 11_000);
    network.tick(NOW + 11_000);
    assert_eq!(states(&mut network), ["error"]);
}

#[test]
fn private_read_startup_keeps_its_existing_fifteen_second_bound() {
    let mut network = Network::default();
    plan(
        &mut network,
        NostrFilter {
            kinds: Some(vec![4]),
            ..Default::default()
        },
        NOW,
    );
    network.tick(NOW + 10_000);
    assert!(states(&mut network).is_empty());
    network.tick(NOW + 15_000);
    assert_eq!(states(&mut network), ["error"]);
}
