use leptos::prelude::*;
use lkjstr_app::FeedContinuationRow;

pub(super) fn continuation_row(
    row: FeedContinuationRow,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    let target_event_id = row.target_event_id.clone();
    let open = move |_| {
        if let Some(callback) = open_thread.as_ref() {
            callback.run(target_event_id.clone());
        }
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
}
