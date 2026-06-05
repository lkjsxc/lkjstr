use crate::public_chat::{
    PublicChatChannel, PublicChatLoadingState, PublicChatMessage, PublicChatMetadata,
    PublicChatPublishState, PublicChatState, PublishRelayResult, empty_public_chat_state,
    sort_channels, sort_messages,
};

#[must_use]
pub fn merge_channel_create(
    mut state: PublicChatState,
    event: &lkjstr_protocol::NostrEvent,
) -> PublicChatState {
    if event.kind != lkjstr_protocol::KIND_CHANNEL_CREATE {
        return state;
    }
    if !state.channels.iter().any(|channel| channel.id == event.id) {
        state.channels.push(PublicChatChannel::from_create(event));
    }
    state.channels = sort_channels(state.channels);
    state
}

#[must_use]
pub fn merge_channel_metadata(
    mut state: PublicChatState,
    event: &lkjstr_protocol::NostrEvent,
) -> PublicChatState {
    let Ok(update) = lkjstr_protocol::parse_channel_metadata_update(event) else {
        return state;
    };
    if let Some(channel) = state
        .channels
        .iter_mut()
        .find(|channel| channel.id == update.channel_id)
        && metadata_is_newer(channel, event)
    {
        channel.metadata = PublicChatMetadata::from(update.metadata);
        channel.metadata_event_id = Some(event.id.clone());
        channel.metadata_updated_at = Some(event.created_at);
        channel.relay_hints = channel.metadata.relays.clone();
    }
    state.channels = sort_channels(state.channels);
    state
}

#[must_use]
pub fn select_channel(mut state: PublicChatState, channel_id: Option<String>) -> PublicChatState {
    state.selected_channel_id = channel_id;
    state.messages.clear();
    state.loading = state
        .selected_channel_id
        .as_ref()
        .map(|id| PublicChatLoadingState::LoadingMessages {
            channel_id: id.clone(),
        })
        .unwrap_or(PublicChatLoadingState::Idle);
    state
}

#[must_use]
pub fn merge_channel_messages(
    mut state: PublicChatState,
    events: &[lkjstr_protocol::NostrEvent],
    relay_urls: &[String],
) -> PublicChatState {
    for event in events {
        if event.kind != lkjstr_protocol::KIND_CHANNEL_MESSAGE {
            continue;
        }
        let Some(channel_id) = lkjstr_protocol::channel_root_event_id(event).map(str::to_owned)
        else {
            continue;
        };
        let hidden = state.hidden_message_ids.contains(&event.id);
        let muted = state.muted_pubkeys.contains(&event.pubkey);
        upsert_message(
            &mut state,
            PublicChatMessage::from_event(
                event,
                channel_id.clone(),
                relay_urls.to_vec(),
                hidden,
                muted,
            ),
        );
        update_last_message(&mut state.channels, &channel_id, event.created_at);
    }
    state.messages = sort_messages(state.messages);
    state.channels = sort_channels(state.channels);
    state.loading = PublicChatLoadingState::Idle;
    state
}

#[must_use]
pub fn apply_own_hide_events(
    mut state: PublicChatState,
    events: &[lkjstr_protocol::NostrEvent],
) -> PublicChatState {
    for event in events {
        if let Some(target) = lkjstr_protocol::hide_message_target(event) {
            push_unique(&mut state.hidden_message_ids, target.to_owned());
        }
    }
    for message in &mut state.messages {
        message.hidden = state.hidden_message_ids.contains(&message.event_id);
    }
    state
}

#[must_use]
pub fn apply_own_mute_events(
    mut state: PublicChatState,
    events: &[lkjstr_protocol::NostrEvent],
) -> PublicChatState {
    for event in events {
        if let Some(target) = lkjstr_protocol::mute_user_target(event) {
            push_unique(&mut state.muted_pubkeys, target.to_owned());
        }
    }
    for message in &mut state.messages {
        message.muted_author = state.muted_pubkeys.contains(&message.pubkey);
    }
    state
}

#[must_use]
pub fn set_composer_text(mut state: PublicChatState, text: impl Into<String>) -> PublicChatState {
    state.composer_draft = text.into();
    state
}

#[must_use]
pub fn mark_publish_queued(mut state: PublicChatState, event_id: String) -> PublicChatState {
    state.publish = PublicChatPublishState::Queued { event_id };
    state.composer_draft.clear();
    state
}

#[must_use]
pub fn merge_publish_result(
    mut state: PublicChatState,
    event_id: String,
    result: PublishRelayResult,
) -> PublicChatState {
    state.publish = if result.failed.is_empty() {
        PublicChatPublishState::Idle
    } else {
        PublicChatPublishState::Partial { event_id, result }
    };
    state
}

#[must_use]
pub fn reset_on_tab_close() -> PublicChatState {
    empty_public_chat_state()
}

fn metadata_is_newer(channel: &PublicChatChannel, event: &lkjstr_protocol::NostrEvent) -> bool {
    channel
        .metadata_updated_at
        .map(|updated_at| (event.created_at, &event.id) > (updated_at, channel_id_ref(channel)))
        .unwrap_or(true)
}

fn channel_id_ref(channel: &PublicChatChannel) -> &String {
    channel.metadata_event_id.as_ref().unwrap_or(&channel.id)
}

fn upsert_message(state: &mut PublicChatState, message: PublicChatMessage) {
    if let Some(existing) = state
        .messages
        .iter_mut()
        .find(|item| item.event_id == message.event_id)
    {
        *existing = message;
    } else {
        state.messages.push(message);
    }
}

fn update_last_message(channels: &mut [PublicChatChannel], channel_id: &str, created_at: u64) {
    if let Some(channel) = channels.iter_mut().find(|item| item.id == channel_id)
        && channel
            .last_message_at
            .is_none_or(|current| created_at > current)
    {
        channel.last_message_at = Some(created_at);
    }
}

fn push_unique(values: &mut Vec<String>, value: String) {
    if !values.contains(&value) {
        values.push(value);
    }
}
