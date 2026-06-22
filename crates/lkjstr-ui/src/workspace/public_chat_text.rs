use lkjstr_domain::{
    PublicChatLoadingState, PublicChatMessage, PublicChatPublishState, PublicChatState,
};

pub fn channel_empty_text(state: &PublicChatState, read_relay_count: usize) -> &'static str {
    if read_relay_count == 0 {
        "Channel discovery unavailable because no read relays are selected."
    } else if state.loading == PublicChatLoadingState::LoadingChannels {
        "Channel discovery is loading."
    } else {
        "No real channels loaded; relay coverage is incomplete."
    }
}

pub fn message_empty_text(state: &PublicChatState) -> &'static str {
    if state.selected_channel_id.is_none() {
        "Open a real channel to load messages."
    } else if matches!(
        state.loading,
        PublicChatLoadingState::LoadingMessages { .. }
    ) {
        "Selected channel messages are loading."
    } else {
        "No real messages loaded; relay coverage is incomplete."
    }
}

pub fn composer_status(active_pubkey: Option<&str>, write_relay_count: usize) -> &'static str {
    if active_pubkey.is_none() {
        "Composer disabled because no signing account is active."
    } else if write_relay_count == 0 {
        "Composer disabled because no enabled write relays are available."
    } else {
        "Composer can publish after explicit signing."
    }
}

pub fn publish_status(state: &PublicChatPublishState) -> String {
    match state {
        PublicChatPublishState::Idle => "No active publish job.".to_owned(),
        PublicChatPublishState::Queued { event_id } => {
            format!("Publish signed locally and queued for event {event_id}.")
        }
        PublicChatPublishState::Partial { event_id, result } => format!(
            "Publish for event {event_id} is partial: {} relay OK, {} relay failed.",
            result.succeeded.len(),
            result.failed.len()
        ),
        PublicChatPublishState::Failed { reason } => {
            format!("Publish failed before relay success: {reason}.")
        }
    }
}

pub fn message_body_text(message: &PublicChatMessage) -> &str {
    if message.hidden {
        "Message hidden by your moderation event."
    } else if message.muted_author {
        "Message muted by your moderation event."
    } else {
        &message.content
    }
}

#[cfg(test)]
mod tests {
    use super::{
        channel_empty_text, composer_status, message_body_text, message_empty_text, publish_status,
    };
    use lkjstr_domain::{
        PublicChatLoadingState, PublicChatMessage, PublicChatPublishState, PublishRelayResult,
        empty_public_chat_state,
    };

    #[test]
    fn public_chat_empty_channel_text_names_real_blocker() {
        let mut state = empty_public_chat_state();
        assert_eq!(
            channel_empty_text(&state, 0),
            "Channel discovery unavailable because no read relays are selected."
        );
        state.loading = PublicChatLoadingState::LoadingChannels;
        assert_eq!(
            channel_empty_text(&state, 2),
            "Channel discovery is loading."
        );
        state.loading = PublicChatLoadingState::Idle;
        assert_eq!(
            channel_empty_text(&state, 2),
            "No real channels loaded; relay coverage is incomplete."
        );
    }

    #[test]
    fn public_chat_empty_message_text_requires_selected_channel() {
        let mut state = empty_public_chat_state();
        assert_eq!(
            message_empty_text(&state),
            "Open a real channel to load messages."
        );
        state.selected_channel_id = Some("channel".to_owned());
        state.loading = PublicChatLoadingState::LoadingMessages {
            channel_id: "channel".to_owned(),
        };
        assert_eq!(
            message_empty_text(&state),
            "Selected channel messages are loading."
        );
        state.loading = PublicChatLoadingState::Idle;
        assert_eq!(
            message_empty_text(&state),
            "No real messages loaded; relay coverage is incomplete."
        );
    }

    #[test]
    fn composer_and_publish_status_are_truthful() {
        assert_eq!(
            composer_status(None, 1),
            "Composer disabled because no signing account is active."
        );
        assert_eq!(
            composer_status(Some("me"), 0),
            "Composer disabled because no enabled write relays are available."
        );
        assert_eq!(
            composer_status(Some("me"), 2),
            "Composer can publish after explicit signing."
        );
        assert_eq!(
            publish_status(&PublicChatPublishState::Idle),
            "No active publish job."
        );
        assert_eq!(
            publish_status(&PublicChatPublishState::Queued {
                event_id: "event".to_owned(),
            }),
            "Publish signed locally and queued for event event."
        );
        assert_eq!(
            publish_status(&PublicChatPublishState::Partial {
                event_id: "event".to_owned(),
                result: PublishRelayResult {
                    succeeded: vec!["wss://ok/".to_owned()],
                    failed: vec!["wss://fail/".to_owned()],
                },
            }),
            "Publish for event event is partial: 1 relay OK, 1 relay failed."
        );
    }

    #[test]
    fn moderated_message_text_does_not_render_hidden_content() {
        let mut message = message("private");
        assert_eq!(message_body_text(&message), "private");
        message.hidden = true;
        assert_eq!(
            message_body_text(&message),
            "Message hidden by your moderation event."
        );
        message.hidden = false;
        message.muted_author = true;
        assert_eq!(
            message_body_text(&message),
            "Message muted by your moderation event."
        );
    }

    fn message(content: &str) -> PublicChatMessage {
        PublicChatMessage {
            event_id: "event".to_owned(),
            channel_id: "channel".to_owned(),
            pubkey: "author".to_owned(),
            created_at: 1,
            content: content.to_owned(),
            reply_to: None,
            relay_urls: Vec::new(),
            hidden: false,
            muted_author: false,
        }
    }
}
