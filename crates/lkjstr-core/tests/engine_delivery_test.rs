#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Output, Query},
        publication_plan::{PublicationInput, plan},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
fn setup() -> (Network, lkjstr_protocol::NostrEvent) {
    let e = event(1, 1, "delivery", vec![]);
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into()], 0);
    n.publish(
        "post".into(),
        e.clone(),
        plan(PublicationInput {
            own: vec![A.into(), B.into()],
            ..Default::default()
        }),
        0,
    );
    n.connected(A, 0);
    n.connected(B, 0);
    n.drain_effects();
    n.drain_output();
    (n, e)
}
fn state(n: &Network, url: &str) -> String {
    n.recent_publications()[0]["deliveries"]
        .as_array()
        .expect("rows")
        .iter()
        .find(|r| r["url"] == url)
        .expect("relay")["state"]
        .as_str()
        .expect("state")
        .into()
}
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| {
            if let Effect::Send(_, s) = e {
                Some(serde_json::from_str(&s).expect("frame"))
            } else {
                None
            }
        })
        .collect()
}
#[test]
fn late_ok_corrects_timeout_and_emits_delivery_without_second_result() {
    let (mut n, e) = setup();
    n.message(A, &json!(["OK", e.id, true, ""]).to_string(), 10);
    n.tick(30000);
    n.drain_output();
    assert_eq!(state(&n, B), "timeout");
    n.message(
        B,
        &json!(["OK", e.id, true, "duplicate: already have it"]).to_string(),
        31000,
    );
    assert_eq!(state(&n, B), "accepted");
    let out = n.drain_output();
    assert!(out.iter().any(|o|matches!(o,Output::Delivery{deliveries,..} if deliveries.iter().all(|d|d.state=="accepted"))));
    assert!(!out.iter().any(|o| matches!(o, Output::Result { .. })));
}
#[test]
fn verified_echo_corrects_only_attempted_relay_and_suppresses_check() {
    let (mut n, e) = setup();
    n.tick(30000);
    n.drain_output();
    n.observe_verified("wss://rebroadcast.test/", &e, 31000);
    assert_eq!(state(&n, B), "timeout");
    n.observe_verified(B, &e, 32000);
    assert_eq!(state(&n, B), "accepted");
    n.tick(37000);
    assert!(
        !n.drain_effects()
            .iter()
            .any(|f| matches!(f,Effect::Send(url,text) if url==B && text.starts_with("[\"REQ\"")))
    );
}
#[test]
fn acknowledgement_survives_disconnect_before_retry() {
    let (mut n, e) = setup();
    n.disconnected(B, 10);
    n.message(B, &json!(["OK", e.id, true, ""]).to_string(), 11);
    assert_eq!(state(&n, B), "accepted");
}
#[test]
fn one_confirmation_on_open_connection_in_seven_seconds_and_close_on_eose() {
    let (mut n, e) = setup();
    let store = Store::new(10);
    let f = NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(10),
        ..Default::default()
    };
    n.plan(vec![("live".into(), f, Query::default())], &store, 100);
    n.tick(30000);
    frames(&mut n);
    n.drain_output();
    n.tick(36999);
    assert!(
        !frames(&mut n)
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["ids"].is_array())
    );
    n.tick(37000);
    let probes: Vec<_> = frames(&mut n)
        .into_iter()
        .filter(|f| f[0] == "REQ" && f[2]["ids"] == json!([e.id]))
        .collect();
    assert_eq!(probes.len(), 2);
    let wire = probes[0][1].as_str().expect("wire");
    if let Some(e) = n.message(A, &json!(["EVENT", wire, e]).to_string(), 37001) {
        n.observe_verified(A, &e, 37001);
    }
    assert_eq!(state(&n, A), "accepted");
    n.message(A, &json!(["EOSE", wire]).to_string(), 37002);
    assert!(frames(&mut n).iter().any(|f| f[0] == "CLOSE"));
    n.tick(45000);
    assert!(
        !frames(&mut n)
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["ids"].is_array())
    );
}
#[test]
fn only_attempted_destinations_are_exposed_to_the_composer() {
    let e = event(1, 1, "not sent everywhere", vec![]);
    let mut n = Network::default();
    n.configure(vec![A.into(), B.into()], 0);
    n.publish(
        "post".into(),
        e.clone(),
        plan(PublicationInput {
            own: vec![A.into(), B.into()],
            ..Default::default()
        }),
        0,
    );
    n.connected(A, 1);
    n.message(A, &json!(["OK", e.id, true, ""]).to_string(), 2);
    n.tick(30000);
    for out in n.drain_output() {
        if let Output::Delivery { deliveries, .. } | Output::Result { deliveries, .. } = out {
            assert!(deliveries.iter().all(|d| d.relay == A));
        }
    }
    n.message(B, &json!(["OK", e.id, true, ""]).to_string(), 31000);
    n.observe_verified(B, &e, 31001);
    assert_eq!(state(&n, B), "timeout");
    assert!(n.drain_output().is_empty());
}
#[test]
fn true_duplicate_is_success_and_relay_refusal_words_survive_history_and_wire() {
    let (mut n, e) = setup();
    n.message(
        A,
        &json!(["OK", e.id, true, "duplicate: saved"]).to_string(),
        1,
    );
    n.message(
        B,
        &json!(["OK", e.id, false, "blocked: relay policy"]).to_string(),
        2,
    );
    assert_eq!(state(&n, A), "accepted");
    assert_eq!(
        n.recent_publications()[0]["messages"][B],
        "blocked: relay policy"
    );
    let engine = lkjstr_core::engine::Engine::new();
    let mut session = lkjstr_core::engine::wire::Session::default();
    let wire: Vec<_> = n
        .drain_output()
        .into_iter()
        .flat_map(|o| session.output(o, &engine))
        .map(|o| serde_json::to_value(o).expect("wire"))
        .collect();
    assert!(
        wire.iter()
            .filter_map(|m| m["relays"].as_array())
            .flatten()
            .any(|d| d["url"] == B && d["message"] == "blocked: relay policy")
    );
}
#[test]
fn normalized_routes_share_the_same_acknowledgement_key() {
    let mut n = Network::default();
    let e = event(1, 1, "URL forms", vec![]);
    n.configure(vec!["wss://A.TEST".into(), A.into()], 0);
    n.publish(
        "post".into(),
        e.clone(),
        plan(PublicationInput {
            own: vec!["wss://A.TEST".into(), A.into()],
            ..Default::default()
        }),
        0,
    );
    n.connected(A, 1);
    n.message(
        A,
        &json!(["OK", e.id, true, "duplicate: saved"]).to_string(),
        2,
    );
    assert_eq!(
        n.recent_publications()[0]["deliveries"]
            .as_array()
            .expect("rows")
            .len(),
        1
    );
    assert_eq!(state(&n, A), "accepted");
}
#[test]
fn watched_receipt_outlives_history_and_release_removes_its_late_callback() {
    let (mut n, e) = setup();
    n.watch_deliveries(vec!["post".into()]);
    n.tick(30000);
    for i in 0..33 {
        let other = event(2 + i, 1, "history", vec![]);
        n.publish(format!("other-{i}"), other, vec![], 30001 + i);
    }
    n.drain_output();
    n.message(A, &json!(["OK", e.id, true, ""]).to_string(), 31000);
    assert!(
        n.drain_output()
            .iter()
            .any(|o| matches!(o,Output::Delivery{req,..} if req=="post"))
    );
    n.watch_deliveries(vec![]);
    n.message(B, &json!(["OK", e.id, true, ""]).to_string(), 32000);
    assert!(n.drain_output().is_empty());
}
