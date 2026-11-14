//! Versioned compact event payloads, with legacy object reads during migration.
use crate::NostrEvent;
use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize)]
struct Compact(
    u8,
    String,
    String,
    u64,
    u64,
    Vec<Vec<String>>,
    String,
    String,
);
pub fn encode(event: &NostrEvent) -> Result<String, serde_json::Error> {
    serde_json::to_string(&Compact(
        1,
        event.id.clone(),
        event.pubkey.clone(),
        event.created_at,
        event.kind,
        event.tags.clone(),
        event.content.clone(),
        event.sig.clone(),
    ))
}
pub fn decode(raw: &str) -> Result<NostrEvent, serde_json::Error> {
    if raw.trim_start().starts_with('{') {
        return serde_json::from_str(raw);
    }
    let Compact(version, id, pubkey, created_at, kind, tags, content, sig) =
        serde_json::from_str(raw)?;
    if version != 1 {
        return Err(serde::de::Error::custom("unsupported cache version"));
    }
    Ok(NostrEvent {
        id,
        pubkey,
        created_at,
        kind,
        tags,
        content,
        sig,
    })
}
