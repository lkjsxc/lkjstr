#![allow(clippy::expect_used)]
use super::{Engine, Query, Source, array, open};

#[test]
fn stats_sanitizes_relay_rows_and_redacts_auth_required_request_labels() {
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
    engine.network.configure(vec![relay.into()], 900);
    open(&mut engine, "feed", Query::default());
    engine.network.connected(relay, 1_100);
    assert!(
        array(&engine.stats(), "requests")
            .iter()
            .any(|request| request["relay"] == "wss://peer.example/service")
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
    let requests = array(&stats, "requests");
    assert!(!requests.is_empty());
    assert!(
        requests
            .iter()
            .all(|request| request["relay"] == "private-relay")
    );
    assert_eq!(stats["relays"][0]["url"], "wss://peer.example/service");
    assert_eq!(stats["relays"][0]["lastError"], "relay-error");
}
