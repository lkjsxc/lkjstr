#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::engine::{
    network::Network,
    protocol::Output,
    publication_plan::{PublicationInput, plan},
};
use serde_json::json;
const R: &str = "wss://delivery.test/";
fn setup(kind: u64) -> (Network, lkjstr_protocol::NostrEvent) {
    let mut n = Network::default();
    let e = event(1, kind, "transport", vec![]);
    n.configure(vec![R.into()], 0);
    n.publish(
        "post".into(),
        e.clone(),
        plan(PublicationInput {
            own: vec![R.into()],
            ..Default::default()
        }),
        0,
    );
    n.connected(R, 0);
    n.drain_effects();
    n.drain_output();
    (n, e)
}
#[test]
fn failed_first_socket_send_is_not_counted_but_failed_retry_preserves_evidence() {
    for first_succeeded in [false, true] {
        let (mut n, e) = setup(1);
        let frame = json!(["EVENT", e]).to_string();
        if first_succeeded {
            n.publication_frame_sent(R, &frame, true);
            n.tick(5000);
        }
        n.publication_frame_sent(R, &frame, false);
        n.message(R, &json!(["OK", e.id, true, ""]).to_string(), 5001);
        assert_eq!(
            n.recent_publications()[0]["deliveries"][0]["state"],
            if first_succeeded {
                "accepted"
            } else {
                "pending"
            }
        );
        if !first_succeeded {
            assert!(
                n.drain_output()
                    .iter()
                    .all(|o| matches!(o,Output::Delivery{deliveries,..} if deliveries.is_empty()))
            );
        }
    }
}
#[test]
fn an_early_echo_is_remembered_without_resolving_before_the_wait_ends() {
    let (mut n, e) = setup(7);
    n.observe_verified(R, &e, 1);
    assert!(n.drain_output().is_empty());
    assert!(n.pending_event(&e.id));
    n.tick(30000);
    assert_eq!(
        n.recent_publications()[0]["deliveries"][0]["state"],
        "accepted"
    );
    n.tick(37000);
    assert!(!n.drain_output().iter().any(|o|matches!(o,Output::Result{deliveries,..} if deliveries.iter().any(|d|d.state!="accepted"))));
}
#[test]
fn unanswered_wire_result_does_not_invent_a_relay_refusal() {
    let engine = lkjstr_core::engine::Engine::new();
    let mut session = lkjstr_core::engine::wire::Session::default();
    let out = session.output(
        Output::Result {
            req: "post".into(),
            id: Some("a".repeat(64)),
            error: None,
            deliveries: vec![lkjstr_core::engine::protocol::Delivery {
                relay: R.into(),
                state: "timeout".into(),
                message: None,
            }],
        },
        &engine,
    );
    let row = serde_json::to_value(&out[0]).expect("wire result");
    assert_eq!(row["ok"], false);
    assert!(row["error"].is_null());
    assert_eq!(row["delivery"][0]["state"], "timeout");
}
#[test]
fn standalone_confirmation_keeps_an_open_socket_without_reconnecting_and_releases_it() {
    let (mut n, _) = setup(7);
    n.tick(30000);
    assert!(n.relays[R].online);
    n.drain_effects();
    n.tick(37000);
    let effects = n.drain_effects();
    assert_eq!(effects.iter().filter(|e|matches!(e,lkjstr_core::engine::network::Effect::Send(_,text) if text.starts_with("[\"REQ\""))).count(),1);
    assert!(
        !effects
            .iter()
            .any(|e| matches!(e, lkjstr_core::engine::network::Effect::Connect(_)))
    );
    n.tick(42000);
    n.tick(42001);
    assert!(!n.relays[R].online);
    n.tick(50000);
    assert!(
        !n.drain_effects()
            .iter()
            .any(|e| matches!(e, lkjstr_core::engine::network::Effect::Connect(_)))
    );
}
