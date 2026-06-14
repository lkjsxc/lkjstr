use leptos::prelude::*;
use lkjstr_app::{
    FeedContinuationRow, FeedDiagnosticRow, FeedNotificationRow, FeedProfileRow, FeedUnavailableRow,
};

pub(crate) fn unavailable(row: FeedUnavailableRow) -> impl IntoView {
    view! {
        <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
            <strong>{row.reason}</strong>
            <p>{row.detail}</p>
        </article>
    }
}

pub(crate) fn diagnostic(row: FeedDiagnosticRow) -> impl IntoView {
    view! {
        <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
            <strong>{format!("{:?}", row.severity)}</strong>
            <p>{row.message}</p>
        </article>
    }
}

pub(crate) fn plain_continuation(row: FeedContinuationRow) -> impl IntoView {
    view! {
        <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
            <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
        </article>
    }
}

pub(crate) fn profile(row: FeedProfileRow) -> impl IntoView {
    view! {
        <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
            <strong>{row.display_name}</strong>
        </article>
    }
}

pub(crate) fn notification(row: FeedNotificationRow) -> impl IntoView {
    view! {
        <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
            <strong>{row.notification_kind}</strong>
        </article>
    }
}
