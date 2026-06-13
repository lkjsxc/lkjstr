use leptos::prelude::*;
use lkjstr_app::{
    FEED_LOAD_OLDER_COMMAND, FeedEventRow, FeedFooterRow, FeedFooterState, FeedViewRow,
    SearchFeedStatus,
};

pub(crate) fn search_row(row: FeedViewRow, older_command: Option<Callback<()>>) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row).into_any(),
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
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
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

fn footer_row(row: FeedFooterRow, older_command: Option<Callback<()>>) -> impl IntoView {
    let command_ready = row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND);
    let row_id = row.row_id;
    let text = footer_state_text(row.state);
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

fn command_footer(row_id: String, text: &'static str, command: Callback<()>) -> impl IntoView {
    let load_older = move |_| command.run(());
    view! {
        <footer class="lkjstr-feed-footer" data-row-id=row_id>
            <button type="button" data-testid="search-load-older" on:click=load_older>
                {text}
            </button>
        </footer>
    }
}

fn event_row(row: FeedEventRow) -> impl IntoView {
    let event_id = row.event_id.clone();
    let row_id = row.row_id.clone();
    let created_at = row.created_at;
    let text_rows = event_text(row);
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("created {created_at}")}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        </article>
    }
}

fn event_text(row: FeedEventRow) -> Vec<String> {
    row.visual_rows
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
        .collect()
}

pub(crate) fn search_status_text(status: SearchFeedStatus) -> &'static str {
    match status {
        SearchFeedStatus::Idle => "Enter a search query",
        SearchFeedStatus::Ready => "Search ready",
        SearchFeedStatus::Partial => "Search partial",
    }
}

fn footer_state_text(state: FeedFooterState) -> &'static str {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_status_text_names_idle_and_partial_states() {
        assert_eq!(
            search_status_text(SearchFeedStatus::Idle),
            "Enter a search query"
        );
        assert_eq!(
            search_status_text(SearchFeedStatus::Partial),
            "Search partial"
        );
    }
}
