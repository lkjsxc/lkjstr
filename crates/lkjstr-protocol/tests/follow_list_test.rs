use lkjstr_protocol::{
    KIND_FOLLOW_LIST, KIND_TEXT_NOTE, follow_entries_from_event, following_count,
};

#[test]
fn extracts_deduped_valid_follow_entries() {
    let alice = "a".repeat(64);
    let bob = "b".repeat(64);
    let event = event(
        KIND_FOLLOW_LIST,
        vec![
            tag(&["p", &alice, "relay.example", "Alice"]),
            tag(&["p", "bad", "wss://bad.example", "Bad"]),
            tag(&["p", &alice, "wss://later.example", "Later"]),
            tag(&["p", &bob, "https://relay.example/path//", ""]),
        ],
    );

    let entries = follow_entries_from_event(&event);

    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].pubkey, alice);
    assert_eq!(entries[0].relay.as_deref(), Some("wss://relay.example/"));
    assert_eq!(entries[0].petname.as_deref(), Some("Alice"));
    assert_eq!(
        entries[1].relay.as_deref(),
        Some("wss://relay.example/path")
    );
    assert_eq!(following_count(&event), 2);
}

#[test]
fn ignores_non_follow_list_events() {
    assert!(follow_entries_from_event(&event(KIND_TEXT_NOTE, Vec::new())).is_empty());
}

fn event(kind: u64, tags: Vec<Vec<String>>) -> lkjstr_protocol::NostrEvent {
    lkjstr_protocol::NostrEvent {
        id: "1".repeat(64),
        pubkey: "2".repeat(64),
        created_at: 1,
        kind,
        tags,
        content: String::new(),
        sig: "3".repeat(128),
    }
}

fn tag(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| (*part).to_owned()).collect()
}
