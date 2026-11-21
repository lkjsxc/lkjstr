#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_core::{
    engine::{
        network::{Effect, Network, Relay},
        protocol::{Output, Query, Source},
        publication_plan::{Destination, PublicationInput, plan},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::json;
use std::collections::BTreeSet;

fn urls(prefix: &str, count: usize) -> Vec<String> {
    (0..count)
        .map(|n| format!("wss://{prefix}{n}.test/"))
        .collect()
}

fn connects(network: &mut Network) -> Vec<String> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Connect(url) => Some(url),
            _ => None,
        })
        .collect()
}

#[test]
fn full_reader_pool_never_skips_publication_routes_and_late_waves_get_their_turn() {
    let mut network = Network::default();
    let readers = urls("reader", 64);
    for url in &readers {
        network.relays.insert(url.clone(), Relay::default());
    }
    network.plan(
        readers
            .iter()
            .enumerate()
            .map(|(i, url)| {
                (
                    format!("reader-{i}"),
                    NostrFilter {
                        kinds: Some(vec![1]),
                        ..Default::default()
                    },
                    Query {
                        source: Source::Relay,
                        target: Some(url.clone()),
                        ..Default::default()
                    },
                )
            })
            .collect(),
        &Store::new(10),
        0,
    );
    assert_eq!(connects(&mut network).len(), 64);

    let own = urls("own", 24);
    let inboxes = [urls("inboxa", 24), urls("inboxb", 24)];
    let planned: Vec<_> = own
        .iter()
        .chain(inboxes.iter().flatten())
        .map(|url| Destination {
            url: url.clone(),
            rule: "own".into(),
            state: "pending".into(),
            reason: None,
        })
        .collect();
    let expected: BTreeSet<_> = planned
        .iter()
        .map(|destination| destination.url.clone())
        .collect();
    let note = event(1, 1, "short-lived publication", vec![]);
    network.publish("post".into(), note.clone(), planned, 1);
    assert_eq!(network.relays.len(), 76);
    let mut wave = connects(&mut network);
    assert_eq!(
        wave,
        own[..12]
            .iter()
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
    );

    let mut sent = BTreeSet::new();
    let mut successes = 0;
    // Wait seven seconds between connection waves. Later waves start after
    // the old 30-second publication deadline, but each gets its own budget.
    for now in (7000..=49000).step_by(7000) {
        if wave.is_empty() {
            break;
        }
        assert!(wave.len() <= 12);
        for url in &wave {
            network.connected(url, now);
            assert!(
                network.drain_effects().into_iter().any(|effect| matches!(
                    effect, Effect::Send(relay, frame)
                    if relay == *url && frame.starts_with("[\"EVENT\"")
                )),
                "missing frame for {url}"
            );
            assert!(sent.insert(url.clone()));
        }
        for url in &wave {
            network.message(
                url,
                &json!(["OK", note.id, true, "saved"]).to_string(),
                now + 1,
            );
        }
        successes += network
            .drain_output()
            .iter()
            .filter(|output| matches!(output, Output::Result { error: None, .. }))
            .count();
        network.tick(now + 2);
        assert!(network.relays.len() <= 76);
        assert!(readers.iter().all(|url| network.relays.contains_key(url)));
        wave = connects(&mut network);
    }
    assert_eq!(sent, expected);
    assert_eq!(successes, 1);
    assert_eq!(network.relays.len(), 64);
    assert!(
        network.recent_publications()[0]["deliveries"]
            .as_array()
            .expect("delivery plan")
            .iter()
            .all(|row| row["state"] == "accepted")
    );
    let mut restored = Network::default();
    restored.restore_publication_routes(&network.publication_routes_json());
    assert_eq!(
        restored
            .published_routes(&note.id)
            .into_iter()
            .collect::<BTreeSet<_>>(),
        expected
    );
}

#[test]
fn configuration_and_queued_work_do_not_wait_for_each_other() {
    let mut network = Network::default();
    let note = event(1, 5, "delete", vec![]);
    let routes = urls("original", 64);
    network.publish(
        "delete".into(),
        note.clone(),
        plan(PublicationInput {
            context: routes.clone(),
            deletion: true,
            ..Default::default()
        }),
        0,
    );
    assert_eq!(connects(&mut network).len(), 12);
    let configured = urls("configured", 24);
    network.configure(configured.clone(), 1);
    assert!(
        configured
            .iter()
            .all(|url| network.relays.contains_key(url))
    );
    assert!(network.deferred_relays.is_empty());
    network.connected(&routes[0], 2);
    network.drain_effects();
    network.message(
        &routes[0],
        &json!(["OK", note.id, true, "saved"]).to_string(),
        3,
    );
    network.tick(4);
    let next = connects(&mut network);
    assert_eq!(next, vec![routes[12].clone()]);
    assert!(!network.pending_event(&note.id));
}

#[test]
fn note_echo_and_wrong_id_ok_cannot_report_initial_success() {
    let mut network = Network::default();
    let note = event(1, 1, "echo only", vec![]);
    let relay = "wss://echo.test/";
    network.publish(
        "note".into(),
        note.clone(),
        plan(PublicationInput {
            own: vec![relay.into()],
            ..Default::default()
        }),
        0,
    );
    network.connected(relay, 1);
    network.drain_effects();
    network.drain_output();
    network.observe_verified(relay, &note, 2);
    network.message(
        relay,
        &json!(["OK", "0".repeat(64), true, "unrelated"]).to_string(),
        3,
    );
    let same_id = json!(["OK", note.id, true, "premature"]).to_string();
    let mut accepted = false;
    network.message_observed(relay, &same_id, 4, |_| accepted = true);
    assert!(!accepted, "an unsent frame cannot have an acknowledgement");
    network.tick(10_001);
    let output = network.drain_output();
    assert!(output.iter().any(|output| matches!(
        output,
        Output::Result { id: Some(id), deliveries, .. }
            if *id == note.id && deliveries.iter().all(|route| route.state != "accepted")
    )));
    assert_eq!(
        network.recent_publications()[0]["deliveries"][0]["state"],
        "timeout"
    );
}
