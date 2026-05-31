use lkjstr_protocol::{
    ClientMessage, MessageErrorCode, NostrEvent, NostrFilter, RelayMessage, encode_client_message,
    parse_client_message_value, parse_relay_message,
};
use serde_json::json;

#[test]
fn encodes_client_messages() -> Result<(), String> {
    let close = encode_client_message(&ClientMessage::Close("sub".to_owned()))
        .map_err(|error| error.to_string())?;
    assert_eq!(close, r#"["CLOSE","sub"]"#);
    let req = encode_client_message(&ClientMessage::Req {
        subscription_id: "sub".to_owned(),
        filters: vec![NostrFilter {
            kinds: Some(vec![1]),
            ..NostrFilter::default()
        }],
    })
    .map_err(|error| error.to_string())?;
    assert_eq!(req, r#"["REQ","sub",{"kinds":[1]}]"#);
    Ok(())
}

#[test]
fn parses_client_messages_before_send() -> Result<(), String> {
    let event = event();
    let event_value = serde_json::to_value(&event).map_err(|error| error.to_string())?;
    let parsed = parse_client_message_value(&json!(["EVENT", event_value]))
        .ok_or_else(|| "event client message should parse".to_owned())?;
    assert!(matches!(parsed, ClientMessage::Event(found) if found.id == event.id));

    let parsed = parse_client_message_value(&json!(["REQ", "sub", {"#t": ["nostr"]}]))
        .ok_or_else(|| "req client message should parse".to_owned())?;
    assert!(matches!(
        parsed,
        ClientMessage::Req { subscription_id, filters }
            if subscription_id == "sub" && filters.first().and_then(|f| f.tags.get("t")).is_some()
    ));
    Ok(())
}

#[test]
fn parses_relay_messages() -> Result<(), String> {
    let event = event();
    let event_message = serde_json::to_string(&json!(["EVENT", "sub", event]))
        .map_err(|error| error.to_string())?;
    assert!(matches!(
        parse_relay_message(&event_message, None),
        Ok(RelayMessage::Event { .. })
    ));
    assert!(matches!(
        parse_relay_message(&format!(r#"["OK","{}",true,"saved"]"#, hex64('0')), None),
        Ok(RelayMessage::Ok { .. })
    ));
    assert!(matches!(
        parse_relay_message(r#"["EOSE","sub"]"#, None),
        Ok(RelayMessage::Eose(_))
    ));
    assert!(matches!(
        parse_relay_message(r#"["CLOSED","sub","limit: slow"]"#, None),
        Ok(RelayMessage::Closed { .. })
    ));
    assert!(matches!(
        parse_relay_message(r#"["NOTICE","hello"]"#, None),
        Ok(RelayMessage::Notice(_))
    ));
    assert!(matches!(
        parse_relay_message(r#"["AUTH","challenge"]"#, None),
        Ok(RelayMessage::Auth(_))
    ));
    Ok(())
}

#[test]
fn fails_safely_for_malformed_relay_messages() {
    assert!(matches!(
        parse_relay_message("nope", None),
        Err(error) if error.code == MessageErrorCode::BadJson
    ));
    assert!(matches!(
        parse_relay_message(r#"["EVENT","sub",{"bad":true}]"#, None),
        Err(error) if error.code == MessageErrorCode::BadEvent
    ));
}

fn event() -> NostrEvent {
    NostrEvent {
        id: hex64('0'),
        pubkey: hex64('1'),
        created_at: 100,
        kind: 1,
        tags: vec![vec!["t".to_owned(), "nostr".to_owned()]],
        content: "message test".to_owned(),
        sig: hex128('2'),
    }
}

fn hex64(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn hex128(character: char) -> String {
    std::iter::repeat_n(character, 128).collect()
}
