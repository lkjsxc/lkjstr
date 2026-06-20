use leptos::{
    ev::{KeyboardEvent, MouseEvent},
    prelude::*,
};
use lkjstr_app::FeedEventRow;

use crate::workspace::feed_event_content::event_content_with_openers;

#[path = "feed_event_row_activation.rs"]
mod feed_event_row_activation;
use feed_event_row_activation::{
    event_row_can_open_thread, event_row_click_opens_thread, event_row_key_opens_thread,
};

pub(crate) fn event_row_with_openers(
    row: FeedEventRow,
    trailing: impl IntoView,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    let event_id = row.event_id;
    let row_id = row.row_id;
    let author = compact_pubkey(&row.author_pubkey);
    let created_at = row.created_at;
    let row_open_thread = open_thread;
    let content = event_content_with_openers(row.content, open_profile, open_thread);
    if !event_row_can_open_thread(&row_open_thread) {
        return view! {
            <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
                <small>{format!("{author} created {created_at}")}</small>
                {content}
                {trailing}
            </article>
        }
        .into_any();
    }
    let Some(open_thread) = row_open_thread else {
        return ().into_any();
    };
    let row_click = row_thread_click(event_id.clone(), open_thread);
    let row_key = row_thread_keydown(event_id.clone(), open_thread);
    view! {
        <article
            class="lkjstr-feed-row event"
            data-row-id=row_id
            data-event-id=event_id
            data-testid="feed-open-thread-row"
            role="button"
            tabindex="0"
            on:click=row_click
            on:keydown=row_key
        >
            <small>{format!("{author} created {created_at}")}</small>
            {content}
            {trailing}
        </article>
    }
    .into_any()
}

fn compact_pubkey(pubkey: &str) -> String {
    let chars = pubkey.chars().collect::<Vec<_>>();
    if chars.len() <= 16 {
        return pubkey.to_owned();
    }
    let prefix = chars.iter().take(8).collect::<String>();
    let suffix = chars
        .iter()
        .skip(chars.len().saturating_sub(8))
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

fn row_thread_click(event_id: String, action: Callback<String>) -> impl Fn(MouseEvent) + 'static {
    move |event| {
        if event_row_click_opens_thread(&event) {
            action.run(event_id.clone());
        }
    }
}

fn row_thread_keydown(
    event_id: String,
    action: Callback<String>,
) -> impl Fn(KeyboardEvent) + 'static {
    move |event| {
        if event_row_key_opens_thread(&event) {
            action.run(event_id.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_pubkey_keeps_both_ends() {
        assert_eq!(compact_pubkey(&"a".repeat(64)), "aaaaaaaa...aaaaaaaa");
        assert_eq!(compact_pubkey("short"), "short");
    }
}
