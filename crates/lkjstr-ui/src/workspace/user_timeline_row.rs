use leptos::prelude::*;
use lkjstr_app::{FeedEventRow, FeedFooterState, FeedViewRow};

use crate::workspace::feed_event_actions::{
    FeedEventActionLabels, event_actions as feed_event_actions,
};
use crate::workspace::feed_event_row::event_row as feed_event_row;
use crate::workspace::user_timeline_actions::UserTimelineActions;

pub(crate) fn timeline_row(row: FeedViewRow, actions: UserTimelineActions) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row, actions).into_any(),
        FeedViewRow::Unavailable(row) => view! {
            <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
                <strong>{row.reason}</strong>
                <p>{row.detail}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Diagnostic(row) => view! {
            <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
                <strong>{format!("{:?}", row.severity)}</strong>
                <p>{row.message}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Footer(row) => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                {footer_state_text(row.state)}
            </footer>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
            </article>
        }
        .into_any(),
    }
}

fn event_row(row: FeedEventRow, actions: UserTimelineActions) -> impl IntoView {
    let event_id = row.event_id.clone();
    let author_pubkey = row.author_pubkey.clone();
    feed_event_row(row, event_actions(event_id, author_pubkey, actions))
}

fn event_actions(event_id: String, pubkey: String, actions: UserTimelineActions) -> impl IntoView {
    feed_event_actions(
        event_id,
        pubkey,
        actions.into(),
        FeedEventActionLabels {
            profile_test_id: "user-timeline-open-profile",
            profile_label: "Profile",
            thread_test_id: "user-timeline-open-thread",
            thread_label: "Thread",
            author_context_test_id: "user-timeline-open-author-context",
            author_context_label: "Author context",
        },
    )
}

fn footer_state_text(state: FeedFooterState) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => "Auth required",
        FeedFooterState::RetryableFailure => "Retry available",
        FeedFooterState::ConfigurationUnavailable => "Configuration unavailable",
        FeedFooterState::TerminalEmpty => "No rows",
        FeedFooterState::TerminalWithRows => "Rows loaded",
        FeedFooterState::OlderLoadReady => "Older rows available",
    }
}
