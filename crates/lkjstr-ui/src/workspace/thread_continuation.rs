use leptos::prelude::*;
use lkjstr_app::FeedContinuationRow;

use crate::workspace::feed_state_row;

pub(super) fn continuation_row(
    row: FeedContinuationRow,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    if !continuation_action_available(&open_thread) {
        return feed_state_row::plain_continuation(row).into_any();
    }
    let Some(open_thread) = open_thread else {
        return ().into_any();
    };
    let target_event_id = row.target_event_id.clone();
    let open = move |_| {
        open_thread.run(target_event_id.clone());
    };
    view! {
        <button
            type="button"
            class="thread-continuation"
            data-row-id=row.row_id
            data-target-event-id=row.target_event_id
            style=format!("--event-depth: {}", row.depth)
            on:click=open
        >
            {format!("Continue thread ({})", row.hidden_count)}
        </button>
    }
    .into_any()
}

fn continuation_action_available(open_thread: &Option<Callback<String>>) -> bool {
    open_thread.is_some()
}

#[cfg(test)]
#[path = "thread_continuation_tests.rs"]
mod thread_continuation_tests;
