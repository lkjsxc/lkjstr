use super::*;
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};
fn record(kind: u64, at: u64) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: "{}".into(),
            tags: vec![],
        },
        &generate_secret_key(),
    )
    .unwrap_or_else(|_| unreachable!())
}
#[test]
fn ttl_uses_observation_time_and_restores_compatible_quality_checkpoints() {
    for (kind, lifetime) in [(0, 900_000), (10002, 300_000)] {
        let event = record(kind, 1);
        let mut store = Store::new(20);
        store.insert(event.clone(), None);
        let mut network = Network::default();
        network.configure(vec!["wss://a.test/".into()], 100_000);
        assert!(!network.metadata_fresh(&store, &event.pubkey, kind, 100_000));
        network.observe_verified("wss://a.test/", &event, 100_000);
        assert!(network.metadata_fresh(&store, &event.pubkey, kind, 100_001));
        let saved = network.quality_json(100_002);
        let mut restarted = Network::default();
        restarted.configure(vec!["wss://a.test/".into()], 100_003);
        restarted.restore_quality(&saved, 100_003);
        assert!(restarted.metadata_fresh(&store, &event.pubkey, kind, 100_004));
        assert!(!restarted.metadata_fresh(&store, &event.pubkey, kind, 100_000 + lifetime));
        restarted.restore_quality(&saved, 99_999);
        assert!(!restarted.metadata_fresh(&store, &event.pubkey, kind, 99_999));
    }
}
#[test]
fn changed_signed_identity_does_not_inherit_an_older_records_ttl() {
    let key = generate_secret_key();
    let event = |at| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 10002,
                content: String::new(),
                tags: vec![],
            },
            &key,
        )
        .unwrap_or_else(|_| unreachable!())
    };
    let old = event(1);
    let new = event(2);
    let mut store = Store::new(20);
    store.insert(old.clone(), None);
    let mut network = Network::default();
    network.observe_verified("wss://a.test/", &old, 10_000);
    store.insert(new.clone(), None);
    assert!(!network.metadata_fresh(&store, &old.pubkey, 10002, 10_001));
    network.observe_verified("wss://a.test/", &new, 10_002);
    network.observe_verified("wss://b.test/", &old, 10_003);
    assert!(network.metadata_fresh(&store, &old.pubkey, 10002, 10_004));
}
#[test]
fn pending_newer_metadata_keeps_its_request_until_eose_and_clock_wakes_for_refresh() {
    let event = record(10002, 1);
    let mut store = Store::new(20);
    store.insert(event.clone(), None);
    let mut network = Network::default();
    network.configure(vec!["wss://a.test/".into()], 100_000);
    let filter = NostrFilter {
        authors: Some(vec![event.pubkey.clone()]),
        kinds: Some(vec![10002]),
        limit: Some(1),
        ..Default::default()
    };
    network.plan(
        vec![("profile".into(), filter, Query::default())],
        &store,
        100_000,
    );
    network.connected("wss://a.test/", 100_050);
    network.observe_verified("wss://a.test/", &event, 100_060);
    assert!(!network.metadata_fresh(&store, &event.pubkey, 10002, 100_061));
    let wire = network
        .requests
        .values()
        .next()
        .map(|r| r.wire_id.clone())
        .unwrap_or_default();
    network.message("wss://a.test/", &json!(["EOSE", wire]).to_string(), 100_070);
    assert!(network.metadata_fresh(&store, &event.pubkey, 10002, 100_071));
    network.plan(vec![], &store, 100_080);
    network.profiles_changed = false;
    network.tick(400_060);
    assert!(network.profiles_changed);
}

#[test]
fn disk_restoration_cannot_renew_a_metadata_ttl() {
    let event = record(0, 1);
    let mut store = Store::new(20);
    store.insert(event.clone(), Some("cache"));
    let mut network = Network::default();
    network.observe_verified("cache", &event, 100_000);
    assert!(!network.metadata_fresh(&store, &event.pubkey, 0, 100_001));
    network.observe_verified("wss://a.test/", &event, 100_002);
    assert!(network.metadata_fresh(&store, &event.pubkey, 0, 100_003));
}
#[test]
fn empty_profile_evidence_survives_replanning_then_retries_after_backoff() {
    let mut network = Network::default();
    let store = Store::new(20);
    let author = "a".repeat(64);
    network.configure(vec!["wss://a.test/".into()], 0);
    let want = (
        "visible".into(),
        NostrFilter {
            authors: Some(vec![author.clone()]),
            kinds: Some(vec![0]),
            limit: Some(1),
            ..Default::default()
        },
        Query {
            source: Source::People,
            ..Default::default()
        },
    );
    network.plan(vec![want.clone()], &store, 0);
    network.connected("wss://a.test/", 1);
    let wire = network
        .requests
        .values()
        .next()
        .map(|r| r.wire_id.clone())
        .unwrap_or_default();
    network.message("wss://a.test/", &json!(["EOSE", wire]).to_string(), 100);
    network.plan(vec![want.clone()], &store, 101);
    assert!(network.profile_absent(&author));
    assert!(!network.metadata_fresh(&store, &author, 0, 101));
    network.profiles_changed = false;
    network.tick(30_100);
    assert!(network.profiles_changed);
    network.plan(vec![want], &store, 30_100);
    assert!(!network.profile_absent(&author));
    network.connected("wss://a.test/", 30_101);
    assert!(
        network
            .requests
            .values()
            .any(|r| r.sent && r.wire_id != wire)
    );
}

#[test]
fn queued_finite_answer_records_verified_latency_after_eose() {
    let event = record(0, 1);
    let mut network = Network::default();
    let store = Store::new(20);
    network.configure(vec!["wss://a.test/".into()], 100_000);
    let filter = NostrFilter {
        authors: Some(vec![event.pubkey.clone()]),
        kinds: Some(vec![0]),
        limit: Some(1),
        ..Default::default()
    };
    network.plan(
        vec![(
            "person".into(),
            filter,
            Query {
                source: Source::People,
                ..Default::default()
            },
        )],
        &store,
        100_000,
    );
    network.connected("wss://a.test/", 100_001);
    let wire = network
        .requests
        .values()
        .next()
        .map(|r| r.wire_id.clone())
        .unwrap_or_default();
    assert!(
        network
            .message(
                "wss://a.test/",
                &json!(["EVENT", wire, event]).to_string(),
                100_002
            )
            .is_some()
    );
    network.message("wss://a.test/", &json!(["EOSE", wire]).to_string(), 100_003);
    assert_eq!(network.relays["wss://a.test/"].first_event_ms, None);
    network.observe_verified("wss://a.test/", &event, 100_010);
    assert_eq!(network.relays["wss://a.test/"].first_event_ms, Some(9));
}

#[test]
fn focused_profile_header_and_route_discovery_outrank_background_hydration() {
    let event = record(0, 1);
    let mut store = Store::new(20);
    store.insert(event.clone(), None);
    let mut network = Network::default();
    network.configure(vec!["wss://a.test/".into()], 100_000);
    let q = Query {
        source: Source::Profile,
        target: Some(event.pubkey.clone()),
        ..Default::default()
    };
    let wants: Vec<_> = [0, 3, 10002]
        .into_iter()
        .map(|kind| {
            (
                "profile".into(),
                NostrFilter {
                    authors: Some(vec![event.pubkey.clone()]),
                    kinds: Some(vec![kind]),
                    limit: Some(1),
                    ..Default::default()
                },
                q.clone(),
            )
        })
        .collect();
    for (focus, expected, now) in [(None, 1, 100_000), (Some("profile"), 0, 100_001)] {
        network.focused_sub = focus.map(str::to_owned);
        network.plan(wants.clone(), &store, now);
        let priorities: Vec<_> = network
            .requests
            .values()
            .map(|r| (r.filter.kinds.clone(), r.priority))
            .collect();
        assert_eq!(priorities.len(), 3);
        assert!(
            priorities.iter().all(|(_, p)| *p == expected),
            "{priorities:?}"
        );
    }
}
