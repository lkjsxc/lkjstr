//! A post is sent now: read cooldown and reconnect backoff belong to reading.
use super::*;
use crate::engine::publication_plan::Destination;
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

const RELAY: &str = "wss://loopback.test/";
const OTHER: &str = "wss://second.test/";
type TestResult = Result<(), Box<dyn std::error::Error>>;

fn staged(network: &mut Network, now: u64) -> Result<Vec<Effect>, &'static str> {
    let event = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            content: "a note that should leave now".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .map_err(|_| "sign fixture note")?;
    let routes = [RELAY, OTHER]
        .iter()
        .filter(|url| network.relays.contains_key(**url))
        .map(|url| Destination {
            url: (*url).into(),
            rule: "own".into(),
            state: "pending".into(),
            reason: None,
        })
        .collect();
    let account = event.pubkey.clone();
    network.publish_as("post".into(), event, routes, now, account);
    Ok(network.drain_effects())
}

fn frames_to(effects: &[Effect], relay: &str) -> usize {
    effects
        .iter()
        .filter(|e| matches!(e, Effect::Send(url, frame) if url == relay && frame.starts_with("[\"EVENT\"")))
        .count()
}

#[test]
fn a_read_rate_limit_does_not_hold_a_post() -> TestResult {
    let mut network = Network::default();
    for url in [RELAY, OTHER] {
        network.relays.insert(
            url.into(),
            Relay {
                online: true,
                ..Default::default()
            },
        );
    }
    network.cool_down(RELAY, 1_000);
    network.cool_down_writes(OTHER, 1_000);
    let effects = staged(&mut network, 1_100)?;
    assert_eq!(frames_to(&effects, RELAY), 1, "read cooldown held the post");
    assert_eq!(frames_to(&effects, OTHER), 0, "an EVENT rate limit is kept");
    Ok(())
}

#[test]
fn a_post_reconnects_through_read_backoff_at_once() -> TestResult {
    let mut network = Network::default();
    network.relays.insert(
        RELAY.into(),
        Relay {
            failures: 6,
            retry_at: 64_000,
            ..Default::default()
        },
    );
    let effects = staged(&mut network, 1_000)?;
    assert!(
        effects
            .iter()
            .any(|e| matches!(e, Effect::Connect(url) if url == RELAY)),
        "the post waited for the reconnect backoff"
    );
    network.connected(RELAY, 1_050);
    assert_eq!(frames_to(&network.drain_effects(), RELAY), 1);
    // A failure while the post still waits is retried soon instead of after the long backoff.
    network.disconnected(RELAY, 1_100);
    assert_eq!(network.relays[RELAY].retry_at, 2_600);
    Ok(())
}
