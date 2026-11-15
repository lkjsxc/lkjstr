#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::Output,
    publication_plan::{PublicationInput, plan},
};
use lkjstr_protocol::{EventTemplate, finalize_event};
use serde_json::json;
fn note() -> lkjstr_protocol::NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "fixture".into(),
        },
        &lkjstr_protocol::parse_secret_key_hex(&"01".repeat(32)).expect("fixture"),
    )
    .expect("fixture")
}
fn urls(prefix: &str, n: usize) -> Vec<String> {
    (0..n).map(|i| format!("wss://{prefix}{i}.test/")).collect()
}
fn sends(n: &mut Network) -> usize {
    n.drain_effects()
        .into_iter()
        .filter(|e| matches!(e,Effect::Send(_,f) if f.starts_with("[\"EVENT\"")))
        .count()
}
#[test]
fn budgets_deduplicate_and_explain_every_excluded_own_route() {
    let own = urls("own", 14);
    let p = plan(PublicationInput {
        own: own.clone(),
        context: vec![own[0].clone(), "wss://reply.test".into()],
        inboxes: (0..5).map(|i| urls(&format!("p{i}"), 3)).collect(),
        deletion: false,
    });
    assert_eq!(p.iter().filter(|d| d.state == "pending").count(), 20);
    assert_eq!(
        p.iter()
            .filter(|d| d.reason.as_deref() == Some("own-cap"))
            .count(),
        2
    );
    assert_eq!(
        p.iter()
            .filter(|d| d.reason.as_deref() == Some("person-cap"))
            .count(),
        5
    );
    assert_eq!(
        p.iter()
            .filter(|d| d.reason.as_deref() == Some("inbox-cap"))
            .count(),
        3
    );
    assert_eq!(p.iter().filter(|d| d.url == own[0]).count(), 1);
}
#[test]
fn twelve_deliveries_connect_retry_and_finish_after_early_success() {
    let mut n = Network::default();
    let event = note();
    let own = urls("own", 12);
    n.publish(
        "post".into(),
        event.clone(),
        plan(PublicationInput {
            own: own.clone(),
            ..Default::default()
        }),
        0,
    );
    assert_eq!(
        n.drain_effects()
            .iter()
            .filter(|e| matches!(e, Effect::Connect(_)))
            .count(),
        12
    );
    for url in &own {
        n.connected(url, 10);
    }
    assert_eq!(sends(&mut n), 12);
    n.message(&own[0], &json!(["OK", event.id, true, ""]).to_string(), 20);
    assert_eq!(
        n.drain_output()
            .iter()
            .filter(|o| matches!(o, Output::Result { error: None, .. }))
            .count(),
        1
    );
    n.disconnected(&own[1], 30);
    n.drain_effects();
    n.tick(2030);
    assert!(
        n.drain_effects()
            .iter()
            .any(|e| matches!(e,Effect::Connect(u) if u==&own[1]))
    );
    n.connected(&own[1], 2031);
    assert_eq!(sends(&mut n), 1);
    n.tick(5010);
    assert_eq!(sends(&mut n), 10);
    for url in own.iter().skip(1) {
        n.message(url, &json!(["OK", event.id, true, ""]).to_string(), 6000);
    }
    n.tick(6001);
    assert!(!n.pending_event(&event.id));
    assert!(
        !n.drain_output()
            .iter()
            .any(|o| matches!(o, Output::Result { .. }))
    );
    assert_eq!(
        n.recent_publications()[0]["deliveries"]
            .as_array()
            .expect("rows")
            .iter()
            .filter(|d| d["state"] == "accepted")
            .count(),
        12
    );
    assert!(n.relays.is_empty());
    let mut restored = Network::default();
    restored.restore_publication_routes(&n.publication_routes_json());
    assert_eq!(restored.published_routes(&event.id).len(), 12);
}
#[test]
fn expiry_never_sends_and_configuration_cannot_drop_pending_routes() {
    let mut n = Network::default();
    let event = note();
    let own = urls("own", 2);
    n.publish(
        "post".into(),
        event.clone(),
        plan(PublicationInput {
            own: own.clone(),
            ..Default::default()
        }),
        0,
    );
    n.configure(vec!["wss://new.test/".into()], 1);
    assert!(n.relays.contains_key(&own[0]));
    n.drain_effects();
    n.connected(&own[0], 30000);
    assert_eq!(sends(&mut n), 0);
    assert!(n.drain_output().iter().any(|o|matches!(o,Output::Result{deliveries,..} if deliveries.iter().all(|d|d.state=="timeout"))));
    assert_eq!(n.publication_stats(&own[0])["publishFailed"], 1);
}
#[test]
fn no_destinations_is_honest_and_unsolicited_ack_cannot_succeed() {
    let mut n = Network::default();
    let event = note();
    n.publish("none".into(), event.clone(), vec![], 0);
    assert!(
        n.drain_output()
            .iter()
            .any(|o| matches!(o,Output::Result{error:Some(e),..} if e=="no-relays"))
    );
    let own = urls("own", 1);
    n.publish(
        "offline".into(),
        event.clone(),
        plan(PublicationInput {
            own: own.clone(),
            ..Default::default()
        }),
        1,
    );
    n.message(&own[0], &json!(["OK", event.id, true, ""]).to_string(), 2);
    assert!(
        !n.drain_output()
            .iter()
            .any(|o| matches!(o, Output::Result { .. }))
    );
}
