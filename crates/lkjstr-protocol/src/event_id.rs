use serde_json::json;
use sha2::{Digest, Sha256};

use crate::{ProtocolError, UnsignedNostrEvent, bytes_to_hex};

pub fn serialize_event(event: &UnsignedNostrEvent) -> Result<String, ProtocolError> {
    serde_json::to_string(&json!([
        0,
        &event.pubkey,
        event.created_at,
        event.kind,
        &event.tags,
        &event.content
    ]))
    .map_err(|error| ProtocolError::Json(error.to_string()))
}

pub fn compute_event_id(event: &UnsignedNostrEvent) -> Result<String, ProtocolError> {
    let serialized = serialize_event(event)?;
    let digest = Sha256::digest(serialized.as_bytes());
    Ok(bytes_to_hex(&digest))
}
