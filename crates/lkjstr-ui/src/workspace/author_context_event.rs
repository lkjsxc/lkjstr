use leptos::prelude::*;
use lkjstr_app::FeedEventRow;

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::feed_event_actions::{
    FeedEventActionLabels, event_actions as feed_event_actions,
};
use crate::workspace::feed_event_row::event_row as feed_event_row;

pub(crate) fn event_row(row: FeedEventRow, actions: AuthorContextActions) -> impl IntoView {
    let event_id = row.event_id.clone();
    let author_pubkey = row.author_pubkey.clone();
    feed_event_row(row, event_actions(event_id, author_pubkey, actions))
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
