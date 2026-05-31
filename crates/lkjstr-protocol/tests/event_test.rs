use lkjstr_protocol::{
    EventFramePolicy, EventValidationCode, NostrEvent, UnsignedNostrEvent, compute_event_id,
    parse_nostr_event_value, serialize_event,
};
use serde_json::json;

#[test]
fn parses_a_valid_event() -> Result<(), String> {
    let value = event_value()?;
    let event = parse_nostr_event_value(&value, None).map_err(|error| error.message)?;
    assert_eq!(event.id, hex64('0'));
    assert_eq!(event.tags, vec![vec!["t".to_owned(), "nostr".to_owned()]]);
    Ok(())
}

#[test]
fn rejects_malformed_fields() -> Result<(), String> {
    let mut bad_pubkey = event_value()?;
    bad_pubkey["pubkey"] = json!("bad");
    let result = parse_nostr_event_value(&bad_pubkey, None);
    assert!(matches!(
        result,
        Err(error) if error.code == EventValidationCode::BadField
    ));

    let mut bad_tag = event_value()?;
    bad_tag["tags"] = json!([["p", 1]]);
    let result = parse_nostr_event_value(&bad_tag, None);
    assert!(matches!(
        result,
        Err(error) if error.code == EventValidationCode::BadTag
    ));
    Ok(())
}

#[test]
fn serializes_and_hashes_using_nip01_order() -> Result<(), String> {
    let event = unsigned_event();
    let serialized = serialize_event(&event).map_err(|error| error.to_string())?;
    assert_eq!(
        serialized,
        r#"[0,"1111111111111111111111111111111111111111111111111111111111111111",1700000000,1,[["t","nostr"]],"hello lkjstr"]"#
    );
    assert_eq!(
        compute_event_id(&event).map_err(|error| error.to_string())?,
        "32c7ebd7164a97770a4dda3682d592d7f7f34354b7cdcc24d21173bcfcda40a1"
    );
    Ok(())
}

#[test]
fn enforces_frame_policy() -> Result<(), String> {
    let policy = EventFramePolicy {
        max_event_content_bytes: 4,
        max_event_tags: 1,
        max_tag_fields: 2,
        max_tag_field_bytes: 5,
    };
    let value = event_value()?;
    let result = parse_nostr_event_value(&value, Some(&policy));
    assert!(matches!(
        result,
        Err(error) if error.code == EventValidationCode::BadField
    ));
    Ok(())
}

fn event_value() -> Result<serde_json::Value, String> {
    serde_json::to_value(event_object()).map_err(|error| error.to_string())
}

fn event_object() -> NostrEvent {
    NostrEvent {
        id: hex64('0'),
        pubkey: hex64('1'),
        created_at: 1_700_000_000,
        kind: 1,
        tags: vec![vec!["t".to_owned(), "nostr".to_owned()]],
        content: "hello lkjstr".to_owned(),
        sig: hex128('2'),
    }
}

fn unsigned_event() -> UnsignedNostrEvent {
    UnsignedNostrEvent {
        pubkey: hex64('1'),
        created_at: 1_700_000_000,
        kind: 1,
        tags: vec![vec!["t".to_owned(), "nostr".to_owned()]],
        content: "hello lkjstr".to_owned(),
    }
}

fn hex64(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn hex128(character: char) -> String {
    std::iter::repeat_n(character, 128).collect()
}
