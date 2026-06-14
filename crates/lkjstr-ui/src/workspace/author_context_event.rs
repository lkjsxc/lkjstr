use leptos::prelude::*;
use lkjstr_app::FeedEventRow;

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::feed_event_actions::{
    FeedEventActionLabels, event_actions as feed_event_actions,
};

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
    feed_event_actions(
        event_id,
        author_pubkey,
        actions.into(),
        FeedEventActionLabels {
            profile_test_id: "author-context-open-profile",
            profile_label: "Open profile",
            thread_test_id: "author-context-open-thread",
            thread_label: "Open thread",
            author_context_test_id: "author-context-open-context",
            author_context_label: "Author context",
        },
    )
}
