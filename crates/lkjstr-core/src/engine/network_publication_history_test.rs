#![allow(clippy::expect_used)]
use super::*;
#[test]
fn discovered_routes_preserve_receipts_and_extend_durable_delete_destinations() {
    let mut network = Network::default();
    let destination = |url: &str, state: &str| Destination {
        url: url.into(),
        rule: "inbox".into(),
        state: state.into(),
        reason: (state == "skipped").then(|| "inbox-cap".into()),
    };
    let id = "a".repeat(64);
    network.publication_history.push_back(Record {
        id: id.clone(),
        kind: 1,
        at: 0,
        unresolved_recipients: 0,
        messages: BTreeMap::new(),
        deliveries: vec![
            destination("wss://accepted.test/", "accepted"),
            destination("wss://skipped.test/", "skipped"),
        ],
    });
    network.retain_routes(id.clone(), vec!["wss://accepted.test/".into()]);
    network.extend_publication_history(
        &id,
        vec![
            destination("wss://accepted.test/", "pending"),
            destination("wss://skipped.test/", "pending"),
            destination("wss://new.test/", "pending"),
        ],
    );
    let rows = network.recent_publications();
    assert_eq!(rows[0]["deliveries"][0]["state"], "accepted");
    assert_eq!(rows[0]["deliveries"][1]["state"], "pending");
    assert_eq!(rows[0]["deliveries"][2]["state"], "pending");
    assert_eq!(network.published_routes(&id).len(), 3);
    let mut restored = Network::default();
    restored.restore_publication_routes(&network.publication_routes_json());
    assert_eq!(
        restored.published_routes(&id),
        network.published_routes(&id)
    );
    assert_eq!(network.publication_revision, 1);
}

fn record(id: usize, deliveries: Vec<Destination>) -> Record {
    Record {
        id: format!("{id:064x}"),
        kind: 1,
        at: 0,
        unresolved_recipients: 0,
        deliveries,
        messages: BTreeMap::new(),
    }
}
fn destination(url: &str, state: &str, reason: Option<&str>) -> Destination {
    Destination {
        url: url.into(),
        rule: "inbox".into(),
        state: state.into(),
        reason: reason.map(str::to_owned),
    }
}
#[test]
fn stats_aggregates_shared_urls_states_reasons_and_idle_relays() {
    let mut engine = crate::engine::Engine::new();
    let url = "wss://shared.test/";
    engine.network.configure(vec!["wss://idle.test/".into()], 0);
    for id in 0..2 {
        let deliveries = [
            ("accepted", None),
            ("pending", None),
            ("rejected", None),
            ("timeout", None),
            ("skipped", Some("own-cap")),
            ("skipped", Some("person-cap")),
            ("skipped", Some("inbox-cap")),
            ("skipped", Some("capacity")),
        ]
        .into_iter()
        .map(|(state, reason)| destination(url, state, reason))
        .collect();
        engine
            .network
            .publication_history
            .push_back(record(id, deliveries));
    }
    let stats = engine.stats();
    let rows = stats["relays"].as_array().expect("relays");
    let shared = rows.iter().find(|r| r["url"] == url).expect("shared");
    for (key, count) in [
        ("publishPlanned", 8),
        ("publishAccepted", 2),
        ("publishPending", 4),
        ("publishFailed", 2),
        ("publishSkipped", 8),
        ("publishOwnSkipped", 2),
        ("publishInboxSkipped", 4),
        ("publishCapacitySkipped", 2),
    ] {
        assert_eq!(shared[key], count, "{key}");
        assert_eq!(rows[0][key], 0, "idle {key}");
    }
    assert_eq!(shared["state"], "idle");
    assert_eq!(shared["openSubscriptions"], 0);
    assert_eq!(
        stats["recentPublications"]
            .as_array()
            .expect("history")
            .len(),
        2
    );
}
#[test]
fn stats_handles_maximum_distinct_publication_destinations() {
    let mut engine = crate::engine::Engine::new();
    for id in 0..32 {
        let deliveries = (0..2240)
            .map(|i| {
                destination(
                    &format!("wss://r{id}-{i}.test/"),
                    "skipped",
                    Some("inbox-cap"),
                )
            })
            .collect();
        engine
            .network
            .publication_history
            .push_back(record(id, deliveries));
    }
    let stats = engine.stats();
    let rows = stats["relays"].as_array().expect("relays");
    assert_eq!(rows.len(), 32 * 2240);
    assert!(rows.iter().all(|r| r["publishSkipped"] == 1
        && r["publishInboxSkipped"] == 1
        && r["publishPlanned"] == 0
        && r["publishFailed"] == 0));
    assert_eq!(
        stats["recentPublications"]
            .as_array()
            .expect("history")
            .len(),
        32
    );
}
