use leptos::prelude::*;
use lkjstr_app::FeedEventRow;

use crate::workspace::author_context_actions::AuthorContextActions;

pub(crate) fn event_row(row: FeedEventRow, actions: AuthorContextActions) -> impl IntoView {
    let event_id = row.event_id.clone();
    let author_pubkey = row.author_pubkey.clone();
    let text_rows = row
        .visual_rows
        .into_iter()
        .filter_map(|item| match item {
            lkjstr_app::FeedVisualRow::EventFull(row) => Some(row.content),
            lkjstr_app::FeedVisualRow::EventTextSegment(row) => Some(row.text),
            lkjstr_app::FeedVisualRow::EventMediaSegment(row) => {
                Some(format!("media segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventReferenceSegment(row) => {
                Some(format!("reference segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventHeader(_)
            | lkjstr_app::FeedVisualRow::EventActions(_) => None,
        })
        .collect::<Vec<_>>();
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row.row_id data-event-id=row.event_id>
            <small>{format!("created {}", row.created_at)}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
            {event_actions(event_id, author_pubkey, actions)}
        </article>
    }
}

fn event_actions(
    event_id: String,
    author_pubkey: String,
    actions: AuthorContextActions,
) -> impl IntoView {
    view! {
        <div class="lkjstr-feed-actions">
            {profile_button(author_pubkey.clone(), actions.open_profile)}
            {thread_button(event_id.clone(), actions.open_thread)}
            {author_context_button(event_id, author_pubkey, actions.open_author_context)}
        </div>
    }
}

fn profile_button(pubkey: String, open: Option<Callback<String>>) -> impl IntoView {
    open.map(|open| {
        let open_profile = move |_| open.run(pubkey.clone());
        view! {
            <button type="button" data-testid="author-context-open-profile" on:click=open_profile>
                "Open profile"
            </button>
        }
    })
}

fn thread_button(event_id: String, open: Option<Callback<String>>) -> impl IntoView {
    open.map(|open| {
        let open_thread = move |_| open.run(event_id.clone());
        view! {
            <button type="button" data-testid="author-context-open-thread" on:click=open_thread>
                "Open thread"
            </button>
        }
    })
}

fn author_context_button(
    event_id: String,
    pubkey: String,
    open: Option<Callback<(String, String)>>,
) -> impl IntoView {
    open.map(|open| {
        let open_context = move |_| open.run((event_id.clone(), pubkey.clone()));
        view! {
            <button type="button" data-testid="author-context-open-context" on:click=open_context>
                "Author context"
            </button>
        }
    })
}
