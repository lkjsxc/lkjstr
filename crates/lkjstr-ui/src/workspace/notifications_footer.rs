use leptos::prelude::*;
use lkjstr_app::{
    FEED_LOAD_OLDER_COMMAND, FeedFooterRow, FeedFooterState, NotificationsOlderLoadTrigger,
};

pub(super) fn footer_row(
    row: FeedFooterRow,
    older_command: Option<Callback<NotificationsOlderLoadTrigger>>,
) -> impl IntoView {
    let command_ready = row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND);
    let row_id = row.row_id;
    let text = footer_text(row.state);
    match (command_ready, older_command) {
        (true, Some(command)) => command_footer(row_id, text, command).into_any(),
        _ => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row_id>
                {text}
            </footer>
        }
        .into_any(),
    }
}

fn command_footer(
    row_id: String,
    text: &'static str,
    command: Callback<NotificationsOlderLoadTrigger>,
) -> impl IntoView {
    let load_older = move |_| command.run(NotificationsOlderLoadTrigger::Explicit);
    view! {
        <footer class="lkjstr-feed-footer" data-row-id=row_id>
            <button type="button" data-testid="notifications-load-older" on:click=load_older>
                {text}
            </button>
        </footer>
    }
}

fn footer_text(state: FeedFooterState) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => "Account required",
        FeedFooterState::RetryableFailure => "Retry available",
        FeedFooterState::ConfigurationUnavailable => "Configuration unavailable",
        FeedFooterState::TerminalEmpty => "No rows",
        FeedFooterState::TerminalWithRows => "Rows loaded",
        FeedFooterState::OlderLoadReady => "Older rows available",
    }
}
