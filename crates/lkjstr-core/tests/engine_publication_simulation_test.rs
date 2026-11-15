//! Deterministic transport simulation; public delivery rates are not inferred.
#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::Output,
    publication_plan::{PublicationInput, plan},
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, parse_secret_key_hex};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, PartialEq)]
struct Scorecard {
    delivered: usize,
    connections: usize,
    frames: usize,
    bytes_out: usize,
    first_success_ms: u64,
}
fn relay(i: usize) -> String {
    format!("wss://r{i:02}.test/")
}
fn event() -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "deterministic publication simulation".into(),
        },
        &parse_secret_key_hex(&"01".repeat(32)).expect("fixture"),
    )
    .expect("event")
}
// Historical algorithm: first three writes, one EVENT per URL; reconnect
// retains the sent set. Relay 2 drops its first EVENT before accepting it.
fn baseline(event: &NostrEvent) -> Scorecard {
    let mut sent = BTreeSet::new();
    let mut accepted = BTreeSet::new();
    let mut connections = 0;
    for (now, index) in [(0, 0), (0, 1), (0, 2), (2000, 2)] {
        connections += 1;
        if now < 10000 && sent.insert(index) && index != 2 {
            accepted.insert(index);
        }
    }
    Scorecard {
        delivered: accepted.len(),
        connections,
        frames: sent.len(),
        bytes_out: sent.len() * json!(["EVENT", event]).to_string().len(),
        first_success_ms: 100,
    }
}
#[test]
fn twelve_outboxes_eight_inboxes_continue_after_first_success_and_recover_drops() {
    let event = event();
    let before = baseline(&event);
    let mut n = Network::default();
    // Thirty-two fake relay addresses; the existing configured-transport cap
    // admits 24. The publication plan selects exactly 20, independently of REQs.
    n.configure((0..32).map(relay).collect(), 0);
    let routes = plan(PublicationInput {
        own: (0..12).map(relay).collect(),
        inboxes: (0..4)
            .map(|i| vec![relay(12 + i * 2), relay(13 + i * 2)])
            .collect(),
        ..Default::default()
    });
    n.publish("post".into(), event.clone(), routes, 0);
    let mut opens = BTreeMap::<String, usize>::new();
    let mut sends = BTreeMap::<String, usize>::new();
    let mut accepted = BTreeSet::new();
    let mut acks = Vec::<(u64, String)>::new();
    let mut bytes = 0;
    let mut first = None;
    let mut results = 0;
    for now in (0..=30000).step_by(100) {
        let due: Vec<_> = acks.iter().filter(|(at, _)| *at <= now).cloned().collect();
        acks.retain(|(at, _)| *at > now);
        for (_, url) in due {
            accepted.insert(url.clone());
            n.message(&url, &json!(["OK", event.id, true, ""]).to_string(), now);
        }
        n.tick(now);
        loop {
            let effects = n.drain_effects();
            if effects.is_empty() {
                break;
            }
            for effect in effects {
                match effect {
                    Effect::Connect(url) => {
                        let count = opens.entry(url.clone()).or_default();
                        *count += 1;
                        if url == relay(19) && *count == 1 {
                            n.disconnected(&url, now);
                        } else {
                            n.connected(&url, now);
                        }
                    }
                    Effect::Send(url, text) => {
                        let frame: serde_json::Value = serde_json::from_str(&text).expect("frame");
                        assert_eq!(frame[0], "EVENT", "publication requires no REQ");
                        bytes += text.len();
                        let count = sends.entry(url.clone()).or_default();
                        *count += 1;
                        if url == relay(2) && *count == 1 {
                            n.disconnected(&url, now);
                        } else {
                            acks.push((now + 100, url));
                        }
                    }
                    _ => {}
                }
            }
        }
        for output in n.drain_output() {
            if let Output::Result { deliveries, .. } = output {
                assert!(deliveries.iter().any(|d| d.state == "accepted"));
                first.get_or_insert(now);
                results += 1;
            }
        }
    }
    let after = Scorecard {
        delivered: accepted.len(),
        connections: opens.values().sum(),
        frames: sends.values().sum(),
        bytes_out: bytes,
        first_success_ms: first.expect("success"),
    };
    assert_eq!(
        results, 1,
        "one success while remaining destinations continue"
    );
    assert_eq!(
        (
            before.delivered,
            before.connections,
            before.frames,
            before.first_success_ms
        ),
        (2, 4, 3, 100)
    );
    assert_eq!(
        (
            after.delivered,
            after.connections,
            after.frames,
            after.first_success_ms
        ),
        (20, 22, 21, 100)
    );
    assert_eq!(after.bytes_out, before.bytes_out * 7);
    assert_eq!(n.publication_stats(&relay(19))["publishAccepted"], 1);
    println!("publication scorecard before={before:?} after={after:?}");
}
