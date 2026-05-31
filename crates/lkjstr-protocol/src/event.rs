use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{event_tags::parse_tags, is_lower_hex};

pub type NostrTag = Vec<String>;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct UnsignedNostrEvent {
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u64,
    pub tags: Vec<NostrTag>,
    pub content: String,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct NostrEvent {
    pub id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub kind: u64,
    pub tags: Vec<NostrTag>,
    pub content: String,
    pub sig: String,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct EventFramePolicy {
    pub max_event_content_bytes: usize,
    pub max_event_tags: usize,
    pub max_tag_fields: usize,
    pub max_tag_field_bytes: usize,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum EventValidationCode {
    NotObject,
    BadField,
    BadTag,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct EventValidationError {
    pub code: EventValidationCode,
    pub message: String,
}

pub fn parse_nostr_event_json(
    json: &str,
    policy: Option<&EventFramePolicy>,
) -> Result<NostrEvent, EventValidationError> {
    let value = serde_json::from_str(json).map_err(|error| EventValidationError {
        code: EventValidationCode::NotObject,
        message: format!("event json is invalid: {error}"),
    })?;
    parse_nostr_event_value(&value, policy)
}

pub fn parse_nostr_event_value(
    value: &Value,
    policy: Option<&EventFramePolicy>,
) -> Result<NostrEvent, EventValidationError> {
    let base = parse_unsigned_event_value(value, policy)?;
    let id = string_field(value, "id", "id must be 32-byte lowercase hex")?;
    if !is_event_id(&id) {
        return bad_field("id must be 32-byte lowercase hex");
    }
    let sig = string_field(value, "sig", "sig must be 64-byte lowercase hex")?;
    if !is_signature(&sig) {
        return bad_field("sig must be 64-byte lowercase hex");
    }
    Ok(NostrEvent {
        id,
        pubkey: base.pubkey,
        created_at: base.created_at,
        kind: base.kind,
        tags: base.tags,
        content: base.content,
        sig,
    })
}

pub fn parse_unsigned_event_value(
    value: &Value,
    policy: Option<&EventFramePolicy>,
) -> Result<UnsignedNostrEvent, EventValidationError> {
    if !value.is_object() {
        return fail(EventValidationCode::NotObject, "event must be an object");
    }
    let pubkey = string_field(value, "pubkey", "pubkey must be 32-byte lowercase hex")?;
    if !is_pubkey(&pubkey) {
        return bad_field("pubkey must be 32-byte lowercase hex");
    }
    let created_at = u64_field(
        value,
        "created_at",
        "created_at must be a non-negative integer",
    )?;
    let kind = u64_field(value, "kind", "kind must be a non-negative integer")?;
    let content = string_field(value, "content", "content must be a string")?;
    if let Some(frame_policy) = policy
        && content.len() > frame_policy.max_event_content_bytes
    {
        return bad_field(format!(
            "content exceeds {} bytes",
            frame_policy.max_event_content_bytes
        ));
    }
    let tags = parse_tags(value.get("tags"), policy)?;
    Ok(UnsignedNostrEvent {
        pubkey,
        created_at,
        kind,
        tags,
        content,
    })
}

pub fn compare_events_desc(a: &NostrEvent, b: &NostrEvent) -> std::cmp::Ordering {
    b.created_at
        .cmp(&a.created_at)
        .then_with(|| a.id.cmp(&b.id))
}

pub fn is_event_id(value: &str) -> bool {
    is_fixed_lower_hex(value, 64)
}

pub fn is_pubkey(value: &str) -> bool {
    is_fixed_lower_hex(value, 64)
}

pub fn is_signature(value: &str) -> bool {
    is_fixed_lower_hex(value, 128)
}

fn string_field(
    value: &Value,
    field: &str,
    message: &'static str,
) -> Result<String, EventValidationError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| EventValidationError {
            code: EventValidationCode::BadField,
            message: message.to_owned(),
        })
}

fn u64_field(
    value: &Value,
    field: &str,
    message: &'static str,
) -> Result<u64, EventValidationError> {
    value
        .get(field)
        .and_then(Value::as_u64)
        .ok_or_else(|| EventValidationError {
            code: EventValidationCode::BadField,
            message: message.to_owned(),
        })
}

fn is_fixed_lower_hex(value: &str, len: usize) -> bool {
    value.len() == len && is_lower_hex(value)
}

pub(crate) fn bad_field<T>(message: impl Into<String>) -> Result<T, EventValidationError> {
    fail(EventValidationCode::BadField, message)
}

pub(crate) fn bad_tag<T>(message: impl Into<String>) -> Result<T, EventValidationError> {
    fail(EventValidationCode::BadTag, message)
}

fn fail<T>(
    code: EventValidationCode,
    message: impl Into<String>,
) -> Result<T, EventValidationError> {
    Err(EventValidationError {
        code,
        message: message.into(),
    })
}
