use lkjstr_domain::PublicChatMetadata;
use lkjstr_protocol::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER, NostrTag, channel_message_reply_tags, channel_message_root_tag,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicChatPublishTemplate {
    pub kind: u64,
    pub content: String,
    pub tags: Vec<NostrTag>,
}

pub fn create_channel_template(
    metadata: &PublicChatMetadata,
) -> Result<PublicChatPublishTemplate, serde_json::Error> {
    Ok(PublicChatPublishTemplate {
        kind: KIND_CHANNEL_CREATE,
        content: serde_json::to_string(metadata)?,
        tags: Vec::new(),
    })
}

pub fn update_channel_metadata_template(
    channel_id: &str,
    metadata: &PublicChatMetadata,
    relay_hint: Option<&str>,
) -> Result<PublicChatPublishTemplate, serde_json::Error> {
    Ok(PublicChatPublishTemplate {
        kind: KIND_CHANNEL_METADATA,
        content: serde_json::to_string(metadata)?,
        tags: vec![channel_message_root_tag(channel_id, relay_hint)],
    })
}

#[must_use]
pub fn channel_message_template(
    channel_id: &str,
    content: impl Into<String>,
    relay_hint: Option<&str>,
) -> PublicChatPublishTemplate {
    PublicChatPublishTemplate {
        kind: KIND_CHANNEL_MESSAGE,
        content: content.into(),
        tags: vec![channel_message_root_tag(channel_id, relay_hint)],
    }
}

#[must_use]
pub fn channel_reply_template(
    channel_id: &str,
    root_message_id: &str,
    reply_message_id: &str,
    content: impl Into<String>,
    relay_hint: Option<&str>,
) -> PublicChatPublishTemplate {
    PublicChatPublishTemplate {
        kind: KIND_CHANNEL_MESSAGE,
        content: content.into(),
        tags: channel_message_reply_tags(channel_id, root_message_id, reply_message_id, relay_hint),
    }
}

#[must_use]
pub fn hide_message_template(
    message_id: &str,
    reason: impl Into<String>,
) -> PublicChatPublishTemplate {
    PublicChatPublishTemplate {
        kind: KIND_CHANNEL_HIDE_MESSAGE,
        content: reason.into(),
        tags: vec![vec!["e".to_owned(), message_id.to_owned()]],
    }
}

#[must_use]
pub fn mute_user_template(pubkey: &str, reason: impl Into<String>) -> PublicChatPublishTemplate {
    PublicChatPublishTemplate {
        kind: KIND_CHANNEL_MUTE_USER,
        content: reason.into(),
        tags: vec![vec!["p".to_owned(), pubkey.to_owned()]],
    }
}
