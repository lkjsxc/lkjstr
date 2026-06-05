use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_METADATA, NostrEvent, channel_root_event_id,
    nip96::valid_https_url, normalize_relay_url,
};

const MAX_NAME_BYTES: usize = 128;
const MAX_ABOUT_BYTES: usize = 1024;
const MAX_PICTURE_BYTES: usize = 2048;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ChannelMetadata {
    pub name: Option<String>,
    pub about: Option<String>,
    pub picture: Option<String>,
    pub relays: Vec<String>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ChannelMetadataUpdate {
    pub channel_id: String,
    pub metadata: ChannelMetadata,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum PublicChatError {
    WrongKind {
        expected: u64,
        actual: u64,
    },
    InvalidJson,
    InvalidMetadata(&'static str),
    FieldTooLong {
        field: &'static str,
        max_bytes: usize,
    },
    MissingChannel,
}

pub fn parse_channel_create_metadata(
    event: &NostrEvent,
) -> Result<ChannelMetadata, PublicChatError> {
    ensure_kind(event, KIND_CHANNEL_CREATE)?;
    parse_metadata_content(&event.content)
}

pub fn parse_channel_metadata_update(
    event: &NostrEvent,
) -> Result<ChannelMetadataUpdate, PublicChatError> {
    ensure_kind(event, KIND_CHANNEL_METADATA)?;
    let channel_id = channel_root_event_id(event)
        .ok_or(PublicChatError::MissingChannel)?
        .to_owned();
    let metadata = parse_metadata_content(&event.content)?;
    Ok(ChannelMetadataUpdate {
        channel_id,
        metadata,
    })
}

fn parse_metadata_content(content: &str) -> Result<ChannelMetadata, PublicChatError> {
    let value = if content.trim().is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_str(content).map_err(|_| PublicChatError::InvalidJson)?
    };
    let object = value.as_object().ok_or(PublicChatError::InvalidMetadata(
        "metadata must be an object",
    ))?;
    Ok(ChannelMetadata {
        name: field_text(object.get("name"), "name", MAX_NAME_BYTES)?,
        about: field_text(object.get("about"), "about", MAX_ABOUT_BYTES)?,
        picture: picture_field(object.get("picture"))?,
        relays: relay_field(object.get("relays")),
    })
}

fn field_text(
    value: Option<&Value>,
    field: &'static str,
    max_bytes: usize,
) -> Result<Option<String>, PublicChatError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let Some(text) = value.as_str() else {
        return Err(PublicChatError::InvalidMetadata(
            "metadata field must be text",
        ));
    };
    let trimmed = text.trim();
    if trimmed.len() > max_bytes {
        return Err(PublicChatError::FieldTooLong { field, max_bytes });
    }
    Ok((!trimmed.is_empty()).then(|| trimmed.to_owned()))
}

fn picture_field(value: Option<&Value>) -> Result<Option<String>, PublicChatError> {
    let Some(text) = field_text(value, "picture", MAX_PICTURE_BYTES)? else {
        return Ok(None);
    };
    Ok(valid_https_url(&text).map(|_| text))
}

fn relay_field(value: Option<&Value>) -> Vec<String> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut relays = Vec::new();
    for item in items {
        if let Some(url) = item.as_str().and_then(normalize_relay_url)
            && !relays.contains(&url)
        {
            relays.push(url);
        }
    }
    relays
}

fn ensure_kind(event: &NostrEvent, expected: u64) -> Result<(), PublicChatError> {
    if event.kind == expected {
        Ok(())
    } else {
        Err(PublicChatError::WrongKind {
            expected,
            actual: event.kind,
        })
    }
}
