use leptos::prelude::*;
use lkjstr_app::FeedEventRow;

use crate::workspace::feed_event_actions::{
    FeedEventActionLabels, FeedEventActions, event_actions,
};
use crate::workspace::feed_event_row::event_row_with_profile_opener;

pub(crate) fn event_row_with_nearby_menu(
    row: FeedEventRow,
    actions: FeedEventActions,
    author_context_test_id: &'static str,
    copy_test_id: &'static str,
) -> impl IntoView {
    let event_id = row.event_id.clone();
    let pubkey = row.author_pubkey.clone();
    let open_profile = actions.profile_opener();
    event_row_with_profile_opener(
        row,
        nearby_event_menu(
            event_id,
            pubkey,
            actions,
            author_context_test_id,
            copy_test_id,
        ),
        open_profile,
    )
}

fn nearby_event_menu(
    event_id: String,
    pubkey: String,
    actions: FeedEventActions,
    author_context_test_id: &'static str,
    copy_test_id: &'static str,
) -> impl IntoView {
    event_actions(
        event_id,
        pubkey,
        actions,
        FeedEventActionLabels {
            profile_test_id: "feed-open-profile",
            profile_label: "Profile",
            thread_test_id: "feed-open-thread",
            thread_label: "Thread",
            author_context_test_id,
            author_context_label: "Nearby posts by this author",
            copy_test_id,
            copy_label: "Copy event ID",
        },
    )
}
