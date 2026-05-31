use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Serialize;

use crate::{KIND_HTTP_AUTH, NostrTag, ProtocolError, UnsignedNostrEvent};

pub struct HttpAuthInput<'a> {
    pub pubkey: &'a str,
    pub url: &'a str,
    pub method: &'a str,
    pub payload_hash: Option<&'a str>,
    pub now: Option<u64>,
}

pub fn http_auth_event(input: &HttpAuthInput<'_>) -> UnsignedNostrEvent {
    let mut tags: Vec<NostrTag> = vec![
        vec!["u".to_owned(), input.url.to_owned()],
        vec!["method".to_owned(), input.method.to_ascii_uppercase()],
    ];
    if let Some(payload_hash) = input.payload_hash {
        tags.push(vec!["payload".to_owned(), payload_hash.to_owned()]);
    }
    UnsignedNostrEvent {
        pubkey: input.pubkey.to_owned(),
        created_at: input.now.unwrap_or_else(unix_now),
        kind: KIND_HTTP_AUTH,
        tags,
        content: String::new(),
    }
}

pub fn nostr_authorization_header<T: Serialize>(event: &T) -> Result<String, ProtocolError> {
    let text =
        serde_json::to_string(event).map_err(|error| ProtocolError::Json(error.to_string()))?;
    Ok(format!("Nostr {}", STANDARD.encode(text.as_bytes())))
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}
