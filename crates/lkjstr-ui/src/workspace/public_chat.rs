use leptos::prelude::*;
use lkjstr_domain::{PublicChatState, empty_public_chat_state};

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
    let relay_text = relay_status(read_relays.len());
    let account_status = active_pubkey
        .as_ref()
        .map(|_| "Signing account available")
        .unwrap_or("No signing account available");
    let channel_view = if state.channels.is_empty() {
        view! { <p>"No real channels loaded."</p> }.into_any()
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
        view! { <p>"No real messages loaded."</p> }.into_any()
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
