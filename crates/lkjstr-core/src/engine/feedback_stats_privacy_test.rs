#![allow(clippy::expect_used)]
use super::{Engine, Query, Relay, Source, array, open};

#[test]
fn stage_snapshot_excludes_private_view_data_and_redacts_auth_history_retroactively() {
    let mut engine = Engine::new();
    let key = "e".repeat(64);
    let target = "private conversation body";
    open(
        &mut engine,
        target,
        Query {
            source: Source::Bookmarks,
            account: Some(key.clone()),
            target: Some(target.into()),
            ..Query::default()
        },
    );
    open(
        &mut engine,
        &key,
        Query {
            source: Source::Profile,
            account: Some(key.clone()),
            target: Some(key.clone()),
            ..Query::default()
        },
    );
    let relay = "wss://peer.example/service?secret=token";
    engine.network.relays.insert(relay.into(), Relay::default());
    engine
        .network
        .message(relay, r#"["NOTICE","rate-limited: retry"]"#, 1000);
    assert_eq!(
        engine.stats()["orchestrationEvents"][0]["relay"],
        "wss://peer.example"
    );
    engine
        .network
        .relays
        .get_mut(relay)
        .expect("relay")
        .last_error = Some(format!("echo {target} {key} secret token"));
    engine
        .network
        .relay_information(relay, r#"{"limitation":{"auth_required":true}}"#);
    let stats = engine.stats();
    let text = stats.to_string();
    for private in [
        target,
        key.as_str(),
        "peer.example/service?",
        "secret",
        "token",
        "echo ",
    ] {
        assert!(!text.contains(private), "{private}");
    }
    assert_eq!(array(&stats, "views").len(), 1);
    assert_eq!(stats["orchestrationEvents"][0]["relay"], "private-relay");
    assert_eq!(stats["relays"][0]["isPrivateHost"], true);
    assert_eq!(stats["relays"][0]["lastError"], "relay-error");
}

#[test]
fn private_host_covers_address_ranges_and_suffixes() {
    let engine = Engine::new();
    for host in [
        "localhost.",
        "sub.localhost",
        "127.8.9.10",
        "[::1]",
        "10.0.0.2",
        "172.31.2.3",
        "192.168.0.2",
        "169.254.0.9",
        "[fe80::1]",
        "[::ffff:192.168.0.2]",
        "lan.local.",
        "something.onion",
    ] {
        assert!(
            engine
                .network
                .is_private_relay(Some(&format!("wss://{host}/"))),
            "{host}"
        );
    }
    for host in [
        "8.8.8.8",
        "172.32.2.3",
        "localhost.example",
        "onion.example",
    ] {
        assert!(
            !engine
                .network
                .is_private_relay(Some(&format!("wss://{host}/"))),
            "{host}"
        );
    }
}
