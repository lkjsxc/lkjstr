use leptos::prelude::*;
use lkjstr_domain::{PublicChatLoadingState, PublicChatState, empty_public_chat_state};

#[component]
pub fn EmptyPublicChatTab() -> impl IntoView {
    view! {
        <PublicChatTab state=empty_public_chat_state() read_relays=Vec::new() active_pubkey=None />
    }
}

#[component]
pub fn PublicChatTab(
    state: PublicChatState,
    read_relays: Vec<String>,
    active_pubkey: Option<String>,
) -> impl IntoView {
    let read_relay_count = read_relays.len();
    let relay_text = relay_status(read_relay_count);
    let channel_empty = channel_empty_text(&state, read_relay_count);
    let message_empty = message_empty_text(&state);
    let account_status = active_pubkey
        .as_ref()
        .map(|_| "Signing account available")
        .unwrap_or("No signing account available");
    let channel_view = if state.channels.is_empty() {
        view! { <p>{channel_empty}</p> }.into_any()
    } else {
        state
            .channels
            .into_iter()
            .map(|channel| {
                let id = channel.id;
                let name = channel
                    .metadata
                    .name
                    .unwrap_or_else(|| "Channel metadata unavailable".to_owned());
                let attr_id = id.clone();
                view! {
                    <article data-channel-id=attr_id>
                        <strong>{name}</strong>
                        <small>{id}</small>
                    </article>
                }
            })
            .collect_view()
            .into_any()
    };
    let message_view = if state.messages.is_empty() {
        view! { <p>{message_empty}</p> }.into_any()
    } else {
        state
            .messages
            .into_iter()
            .map(|message| {
                let event_id = message.event_id;
                view! {
                    <article data-event-id=event_id>
                        <small>{message.pubkey}</small>
                        <p>{message.content}</p>
                    </article>
                }
            })
            .collect_view()
            .into_any()
    };
    view! {
        <section class="feed-tab lkjstr-public-chat" aria-label="Public Chat">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner public-chat-list-scroll" data-scroll-owner="">
                    <p class="lkjstr-public-chat-relay-status">{relay_text}</p>
                    <p class="lkjstr-public-chat-account-status">{account_status}</p>
                    <div class="lkjstr-public-chat-channels">
                        <h2>"Channels"</h2>
                        {channel_view}
                    </div>
                    <div class="lkjstr-public-chat-messages">
                        <h2>"Messages"</h2>
                        {message_view}
                    </div>
                </div>
            </div>
        </section>
    }
}

fn relay_status(count: usize) -> String {
    if count == 0 {
        "No read relays selected.".to_owned()
    } else {
        format!("{count} read relays selected.")
    }
}

fn channel_empty_text(state: &PublicChatState, read_relay_count: usize) -> &'static str {
    if read_relay_count == 0 {
        "Channel discovery unavailable because no read relays are selected."
    } else if state.loading == PublicChatLoadingState::LoadingChannels {
        "Channel discovery is loading."
    } else {
        "No real channels loaded; relay coverage is incomplete."
    }
}

fn message_empty_text(state: &PublicChatState) -> &'static str {
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

#[cfg(test)]
mod tests {
    use super::{channel_empty_text, message_empty_text};
    use lkjstr_domain::{PublicChatLoadingState, empty_public_chat_state};

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
}
