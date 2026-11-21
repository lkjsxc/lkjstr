#![allow(clippy::expect_used)]

mod engine_review_support;

use engine_review_support::event;
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::Output,
    publication_plan::{PublicationInput, plan},
};
use serde_json::json;

const HEALTHY: &str = "wss://context.test/";

fn accepts_on_thirteenth_route(kind: u64) {
    let mut network = Network::default();
    let note = event(1, kind, "publication slot fixture", vec![]);
    let own = (0..12).map(|i| format!("wss://silent-{i}.test/")).collect();
    let routes = plan(PublicationInput {
        own,
        context: vec![HEALTHY.into()],
        deletion: kind == 5,
        ..Default::default()
    });
    assert_eq!(routes.iter().filter(|r| r.state == "pending").count(), 13);
    let competing = event(2, 1, "competing note holds the separate slots", vec![]);
    network.publish(
        "note".into(),
        competing,
        plan(PublicationInput {
            own: (0..12).map(|i| format!("wss://note-{i}.test/")).collect(),
            ..Default::default()
        }),
        0,
    );
    assert_eq!(
        network
            .drain_effects()
            .iter()
            .filter(|e| matches!(e, Effect::Connect(_)))
            .count(),
        12
    );
    network.publish("publish".into(), note.clone(), routes, 0);

    let mut opened = 0;
    let mut context_connected = false;
    let mut context_sent = false;
    let mut accepted = false;
    for now in (1..=30_001).step_by(100) {
        for effect in network.drain_effects() {
            match effect {
                Effect::Connect(url) => {
                    opened += 1;
                    context_connected |= url == HEALTHY;
                    network.connected(&url, now);
                }
                Effect::Send(url, frame) if url == HEALTHY && frame.starts_with("[\"EVENT\",") => {
                    context_sent = true;
                    network.message(
                        HEALTHY,
                        &json!(["OK", note.id, true, "accepted"]).to_string(),
                        now,
                    );
                }
                _ => {}
            }
        }
        accepted |= network.drain_output().into_iter().any(|output| {
            matches!(output, Output::Result { req, id: Some(id), deliveries, error: None }
                if req == "publish" && id == note.id && deliveries.iter().any(|delivery|
                    delivery.relay == HEALTHY && delivery.state == "accepted"))
        });
        network.tick(now);
    }
    assert!(
        accepted,
        "kind {kind}: {opened} connect effects, healthy context connected={context_connected}, sent={context_sent}"
    );
}

#[test]
fn reaction_reaches_healthy_context_when_own_routes_are_silent() {
    accepts_on_thirteenth_route(7);
}

#[test]
fn deletion_reaches_healthy_context_when_own_routes_are_silent() {
    accepts_on_thirteenth_route(5);
}
