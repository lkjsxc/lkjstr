#![allow(clippy::expect_used)]
use super::thin_link_test::{A, NOW, setup, signed};
use super::*;

#[test]
fn verified_healthy_delivery_resets_backoff_but_a_flapping_handshake_does_not() {
    let (mut network, _, _, frame) = setup(false);
    network.relays.get_mut(A).expect("relay").failures = 5;
    network.message(A, &json!(["EOSE", frame[1]]).to_string(), NOW + 20);
    let note = signed(190, "healthy recovery");
    for (at, failures) in [(NOW + 1_000, 5), (NOW + 10_010, 0)] {
        let accepted = network
            .message(A, &json!(["EVENT", frame[1], note]).to_string(), at)
            .expect("live matching delivery");
        network.event(A, &accepted, at + 1);
        assert_eq!(network.relays[A].failures, failures);
    }
    network.disconnected(A, NOW + 10_100);
    assert_eq!(network.relays[A].failures, 1);
    assert!(network.relays[A].retry_at < NOW + 13_100);

    network.connected(A, NOW + 13_100);
    assert_eq!(network.relays[A].failures, 1);
    network.disconnected(A, NOW + 13_101);
    assert_eq!(network.relays[A].failures, 2);
    assert!(network.relays[A].retry_at >= NOW + 17_101);
}

#[test]
fn healthy_traffic_does_not_lift_an_explicit_rate_limit_cooldown() {
    let (mut network, _, _, frame) = setup(false);
    network.message(A, &json!(["EOSE", frame[1]]).to_string(), NOW + 20);
    let relay = network.relays.get_mut(A).expect("relay");
    relay.failures = 5;
    relay.cooldown_until = NOW + 60_000;
    let note = signed(190, "cooling down");
    let accepted = network
        .message(
            A,
            &json!(["EVENT", frame[1], note]).to_string(),
            NOW + 11_000,
        )
        .expect("matching live delivery");
    network.event(A, &accepted, NOW + 11_001);
    assert_eq!(network.relays[A].failures, 5);
    assert_eq!(network.relays[A].cooldown_until, NOW + 60_000);
}

#[test]
fn unrelated_verified_events_cannot_reset_a_transport_failure_history() {
    let (mut network, _, _, frame) = setup(false);
    network.message(A, &json!(["EOSE", frame[1]]).to_string(), NOW + 20);
    network.relays.get_mut(A).expect("relay").failures = 5;
    let mut unrelated = signed(190, "not a timeline event");
    unrelated.kind = 99;
    network.observe_verified(A, &unrelated, NOW + 11_000);
    assert_eq!(network.relays[A].failures, 5);
}
