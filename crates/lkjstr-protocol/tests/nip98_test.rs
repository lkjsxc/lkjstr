use base64::{Engine, engine::general_purpose::STANDARD};
use lkjstr_protocol::{HttpAuthInput, KIND_HTTP_AUTH, http_auth_event, nostr_authorization_header};
use serde_json::Value;

#[test]
fn builds_http_auth_events() {
    let event = http_auth_event(&HttpAuthInput {
        pubkey: &"a".repeat(64),
        url: "https://media.example/upload",
        method: "post",
        payload_hash: Some("b".repeat(64).as_str()),
        now: Some(10),
    });
    assert_eq!(event.kind, KIND_HTTP_AUTH);
    assert_eq!(event.created_at, 10);
    assert_eq!(
        event.tags,
        vec![
            vec!["u".to_owned(), "https://media.example/upload".to_owned()],
            vec!["method".to_owned(), "POST".to_owned()],
            vec!["payload".to_owned(), "b".repeat(64)],
        ]
    );
}

#[test]
fn encodes_nostr_authorization_header() -> Result<(), String> {
    let event = http_auth_event(&HttpAuthInput {
        pubkey: &"a".repeat(64),
        url: "https://media.example/upload",
        method: "POST",
        payload_hash: None,
        now: Some(11),
    });
    let header = nostr_authorization_header(&event).map_err(|error| error.to_string())?;
    let encoded = header
        .strip_prefix("Nostr ")
        .ok_or_else(|| "missing prefix".to_owned())?;
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|error| error.to_string())?;
    let decoded: Value = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    assert_eq!(decoded["kind"], KIND_HTTP_AUTH);
    assert_eq!(decoded["content"], "");
    Ok(())
}
