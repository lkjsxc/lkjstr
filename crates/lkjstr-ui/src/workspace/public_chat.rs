use leptos::prelude::*;
use lkjstr_domain::{PublicChatMessage, PublicChatState, empty_public_chat_state};

#[path = "public_chat_text.rs"]
mod public_chat_text;

use self::public_chat_text::{
    channel_empty_text, composer_status, message_body_text, message_empty_text, publish_status,
};

#[component]
pub fn EmptyPublicChatTab() -> impl IntoView {
    view! {
        <PublicChatTab
            state=empty_public_chat_state()
            read_relays=Vec::new()
            write_relays=Vec::new()
            active_pubkey=None
        />
    }
}

#[component]
pub fn PublicChatTab(
    state: PublicChatState,
    read_relays: Vec<String>,
    write_relays: Vec<String>,
    active_pubkey: Option<String>,
) -> impl IntoView {
    let read_relay_count = read_relays.len();
    let write_relay_count = write_relays.len();
    let relay_text = relay_status(read_relay_count);
    let write_relay_text = write_relay_status(write_relay_count);
    let channel_empty = channel_empty_text(&state, read_relay_count);
    let message_empty = message_empty_text(&state);
    let account_status = active_pubkey
        .as_ref()
        .map(|_| "Signing account available")
        .unwrap_or("No signing account available");
    let composer = composer_status(active_pubkey.as_deref(), write_relay_count);
    let publish = publish_status(&state.publish);
    let diagnostics = state.diagnostics.clone();
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
            .map(message_row)
            .collect_view()
            .into_any()
    };
    let diagnostic_view = diagnostics
        .into_iter()
        .map(|diagnostic| view! { <li>{diagnostic}</li> })
        .collect_view();
    view! {
        <section class="feed-tab lkjstr-public-chat" aria-label="Public Chat">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner public-chat-list-scroll" data-scroll-owner="">
                    <p class="lkjstr-public-chat-relay-status">{relay_text}</p>
                    <p class="lkjstr-public-chat-write-status">{write_relay_text}</p>
                    <p class="lkjstr-public-chat-account-status">{account_status}</p>
                    <p class="lkjstr-public-chat-composer-status">{composer}</p>
                    <p class="lkjstr-public-chat-publish-status">{publish}</p>
                    <div class="lkjstr-public-chat-channels">
                        <h2>"Channels"</h2>
                        {channel_view}
                    </div>
                    <div class="lkjstr-public-chat-messages">
                        <h2>"Messages"</h2>
                        {message_view}
                    </div>
                    <ul class="lkjstr-public-chat-diagnostics">{diagnostic_view}</ul>
                </div>
            </div>
        </section>
    }
}

fn message_row(message: PublicChatMessage) -> impl IntoView {
    let event_id = message.event_id.clone();
    let body = message_body_text(&message).to_owned();
    view! {
        <article data-event-id=event_id>
            <small>{message.pubkey}</small>
            <p>{body}</p>
        </article>
    }
}

fn relay_status(count: usize) -> String {
    if count == 0 {
        "No read relays selected.".to_owned()
    } else {
        format!("{count} read relays selected.")
    }
}

fn write_relay_status(count: usize) -> String {
    if count == 0 {
        "No write relays selected.".to_owned()
    } else {
        format!("{count} write relays selected.")
    }
}
