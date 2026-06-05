use crate::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER, NostrEvent, NostrTag,
};

pub use crate::public_chat_metadata::{
    ChannelMetadata, ChannelMetadataUpdate, PublicChatError, parse_channel_create_metadata,
    parse_channel_metadata_update,
};

#[must_use]
pub const fn is_public_chat_kind(kind: u64) -> bool {
    matches!(
        kind,
        KIND_CHANNEL_CREATE
            | KIND_CHANNEL_METADATA
            | KIND_CHANNEL_MESSAGE
            | KIND_CHANNEL_HIDE_MESSAGE
            | KIND_CHANNEL_MUTE_USER
    )
}

#[must_use]
pub fn channel_root_event_id(event: &NostrEvent) -> Option<&str> {
    event_marker(&event.tags, "root").or_else(|| first_tag_value_ref(&event.tags, "e"))
}

#[must_use]
pub fn channel_reply_event_id(event: &NostrEvent) -> Option<&str> {
    event_marker(&event.tags, "reply").or_else(|| last_non_root_event(&event.tags))
}

#[must_use]
pub fn channel_message_root_tag(channel_id: &str, relay_hint: Option<&str>) -> NostrTag {
    marked_event_tag(channel_id, relay_hint, "root")
}

#[must_use]
pub fn channel_message_reply_tags(
    channel_id: &str,
    root_message_id: &str,
    reply_message_id: &str,
    relay_hint: Option<&str>,
) -> Vec<NostrTag> {
    let mut tags = vec![channel_message_root_tag(channel_id, relay_hint)];
    if !root_message_id.is_empty() {
        tags.push(marked_event_tag(root_message_id, relay_hint, "root"));
    }
    if !reply_message_id.is_empty() && reply_message_id != root_message_id {
        tags.push(marked_event_tag(reply_message_id, relay_hint, "reply"));
    }
    tags
}

#[must_use]
pub fn hide_message_target(event: &NostrEvent) -> Option<&str> {
    first_tag_value_ref(&event.tags, "e")
}

#[must_use]
pub fn mute_user_target(event: &NostrEvent) -> Option<&str> {
    first_tag_value_ref(&event.tags, "p")
}

fn marked_event_tag(event_id: &str, relay_hint: Option<&str>, marker: &str) -> NostrTag {
    vec![
        "e".to_owned(),
        event_id.to_owned(),
        relay_hint.unwrap_or_default().to_owned(),
        marker.to_owned(),
    ]
}

fn first_tag_value_ref<'a>(tags: &'a [NostrTag], name: &str) -> Option<&'a str> {
    tags.iter()
        .find(|tag| tag.first().is_some_and(|item| item == name))
        .and_then(|tag| tag.get(1).map(String::as_str))
}

fn event_marker<'a>(tags: &'a [NostrTag], marker: &str) -> Option<&'a str> {
    tags.iter()
        .find(|tag| {
            tag.first().is_some_and(|item| item == "e")
                && tag.get(3).is_some_and(|item| item == marker)
        })
        .and_then(|tag| tag.get(1).map(String::as_str))
}

fn last_non_root_event(tags: &[NostrTag]) -> Option<&str> {
    let root = event_marker(tags, "root");
    tags.iter()
        .rev()
        .filter(|tag| tag.first().is_some_and(|item| item == "e"))
        .filter_map(|tag| tag.get(1).map(String::as_str))
        .find(|event_id| Some(*event_id) != root)
}
