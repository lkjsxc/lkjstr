use lkjstr_protocol::normalize_relay_url;

#[test]
fn defaults_bare_hosts_to_secure_websocket_urls() {
    assert_eq!(
        normalize_relay_url("relay.example"),
        Some("wss://relay.example/".to_owned())
    );
    assert_eq!(
        normalize_relay_url("relay.example/path"),
        Some("wss://relay.example/path".to_owned())
    );
}

#[test]
fn converts_http_schemes_to_websocket_schemes() {
    assert_eq!(
        normalize_relay_url("http://relay.example"),
        Some("ws://relay.example/".to_owned())
    );
    assert_eq!(
        normalize_relay_url("https://relay.example"),
        Some("wss://relay.example/".to_owned())
    );
}

#[test]
fn normalizes_path_query_and_fragment_components() {
    assert_eq!(
        normalize_relay_url("wss://relay.example//inbox///?z=last&a=first#ignored"),
        Some("wss://relay.example/inbox?a=first&z=last".to_owned())
    );
    assert_eq!(
        normalize_relay_url("wss://relay.example/nested/path/"),
        Some("wss://relay.example/nested/path".to_owned())
    );
}

#[test]
fn rejects_unsupported_or_malformed_urls() {
    assert_eq!(normalize_relay_url("ftp://relay.example"), None);
    assert_eq!(normalize_relay_url("://missing-scheme"), None);
    assert_eq!(normalize_relay_url("wss://"), None);
}
