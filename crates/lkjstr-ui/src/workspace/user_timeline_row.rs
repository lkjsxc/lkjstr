use leptos::prelude::*;
use lkjstr_app::{FeedEventRow, FeedFooterState, FeedViewRow};

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
    let text_rows = row
        .visual_rows
        .into_iter()
        .filter_map(event_text)
        .collect::<Vec<_>>();
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row.row_id data-event-id=row.event_id>
            <small>{format!("created {}", row.created_at)}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
            {event_actions(event_id, author_pubkey, actions)}
        </article>
    }
}

fn event_text(item: lkjstr_app::FeedVisualRow) -> Option<String> {
    match item {
        lkjstr_app::FeedVisualRow::EventFull(row) => Some(row.content),
        lkjstr_app::FeedVisualRow::EventTextSegment(row) => Some(row.text),
        lkjstr_app::FeedVisualRow::EventMediaSegment(row) => {
            Some(format!("media segment {}", row.index))
        }
        lkjstr_app::FeedVisualRow::EventReferenceSegment(row) => {
            Some(format!("reference segment {}", row.index))
        }
        lkjstr_app::FeedVisualRow::EventHeader(_) | lkjstr_app::FeedVisualRow::EventActions(_) => {
            None
        }
    }
}

fn event_actions(event_id: String, pubkey: String, actions: UserTimelineActions) -> impl IntoView {
    view! {
        <div class="lkjstr-feed-actions">
            {string_button(pubkey.clone(), actions.open_profile, "user-timeline-open-profile", "Profile")}
            {string_button(event_id.clone(), actions.open_thread, "user-timeline-open-thread", "Thread")}
            {author_context_button(event_id, pubkey, actions.open_author_context)}
        </div>
    }
}

fn string_button(
    value: String,
    action: Option<Callback<String>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |_| action.run(value.clone());
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}

fn author_context_button(
    event_id: String,
    pubkey: String,
    action: Option<Callback<(String, String)>>,
) -> impl IntoView {
    action.map(|action| {
        let run = move |_| action.run((event_id.clone(), pubkey.clone()));
        view! {
            <button type="button" data-testid="user-timeline-open-author-context" on:click=run>
                "Author context"
            </button>
        }
    })
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
