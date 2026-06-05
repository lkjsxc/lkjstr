use std::cmp::Reverse;

use crate::public_chat::{PublicChatChannel, PublicChatMessage};

#[must_use]
pub fn sort_channels(mut channels: Vec<PublicChatChannel>) -> Vec<PublicChatChannel> {
    channels.sort_by(|a, b| {
        channel_activity(b)
            .cmp(&channel_activity(a))
            .then_with(|| a.id.cmp(&b.id))
    });
    channels
}

#[must_use]
pub fn sort_messages(mut messages: Vec<PublicChatMessage>) -> Vec<PublicChatMessage> {
    messages.sort_by_key(|message| (message.created_at, message.event_id.clone()));
    messages
}

#[must_use]
pub fn newest_channel_first_key(channel: &PublicChatChannel) -> (Reverse<u64>, String) {
    (Reverse(channel_activity(channel)), channel.id.clone())
}

fn channel_activity(channel: &PublicChatChannel) -> u64 {
    channel
        .last_message_at
        .or(channel.metadata_updated_at)
        .unwrap_or(channel.created_at)
}
