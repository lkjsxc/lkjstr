use lkjstr_protocol::{
    KIND_RELAY_LIST_METADATA, NostrEvent, RelayListSuggestion, parse_relay_list_suggestions,
};

#[test]
fn parses_read_write_both_duplicate_and_malformed_tags() {
    assert_eq!(
        parse_relay_list_suggestions(&event(vec![
            tag(&["r", "relay.example"]),
            tag(&["r", "wss://write.example", "write"]),
            tag(&["r", "wss://read.example", "read"]),
            tag(&["r", "wss://read.example", "write"]),
            tag(&["r", "ftp://bad.example"]),
            tag(&["p", "ignored"]),
        ])),
        vec![
            suggestion("wss://read.example/", true, true),
            suggestion("wss://relay.example/", true, true),
            suggestion("wss://write.example/", false, true),
        ]
    );
}

#[test]
fn ignores_non_relay_list_events() {
    let mut item = event(vec![tag(&["r", "relay.example"])]);
    item.kind = 1;
    assert!(parse_relay_list_suggestions(&item).is_empty());
}

fn event(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "1".repeat(64),
        sig: "1".repeat(128),
        pubkey: "2".repeat(64),
        kind: KIND_RELAY_LIST_METADATA,
        tags,
        created_at: 100,
        content: String::new(),
    }
}

fn suggestion(relay_url: &str, read: bool, write: bool) -> RelayListSuggestion {
    RelayListSuggestion {
        relay_url: relay_url.to_owned(),
        read,
        write,
    }
}

fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
