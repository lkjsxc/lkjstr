use crate::{
    EventDisplayContext, FeedFooterState, FeedStateRow, FeedViewModelInput, SearchQueryInput,
    build_feed_view_model, diagnostic_state_row, footer_row, footer_row_from_window,
    search_query_input, unavailable_state_row,
};

use super::{SearchFeedSourceState, SearchFeedStatus, SearchFeedView, SearchFeedViewInput};

#[must_use]
pub fn build_search_feed_view(input: SearchFeedViewInput) -> SearchFeedView {
    let feed_id = search_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let query = submitted_query(input.submitted_query.as_deref());
    let (status, remote_query, footer_state) =
        search_state(&input, &feed_id, query.as_deref(), &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let window = input.window.clone();
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::Search,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    SearchFeedView {
        status,
        submitted_query: query,
        remote_query,
        window,
        view_model,
    }
}

#[must_use]
pub fn search_feed_id(owner: &str) -> String {
    format!("search:{owner}")
}

fn search_state(
    input: &SearchFeedViewInput,
    feed_id: &str,
    query: Option<&str>,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    SearchFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let Some(query) = query else {
        return (
            SearchFeedStatus::Idle,
            None,
            Some(footer_row(feed_id, FeedFooterState::TerminalEmpty)),
        );
    };
    let remote_query = search_query(input, query);
    match &input.source_state {
        SearchFeedSourceState::Idle => (SearchFeedStatus::Ready, remote_query, None),
        SearchFeedSourceState::Pending => (SearchFeedStatus::Searching, remote_query, None),
        SearchFeedSourceState::RelayProgressive => (SearchFeedStatus::Ready, remote_query, None),
        SearchFeedSourceState::CacheComplete => cache_complete(input, feed_id, remote_query),
        SearchFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-search-coverage",
                "search",
                reason,
                *retry_available,
            ));
            let footer_state =
                if input.window.has_older && !input.window.visible_events().is_empty() {
                    FeedFooterState::OlderLoadReady
                } else {
                    FeedFooterState::Partial
                };
            (
                SearchFeedStatus::Partial,
                remote_query,
                Some(footer_row(feed_id, footer_state)),
            )
        }
    }
}

fn search_query(input: &SearchFeedViewInput, query: &str) -> Option<crate::QueryDemandInput> {
    search_query_input(SearchQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: input.disabled_relays.clone(),
        query: query.to_owned(),
        since: input.since,
        until: input.until,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

fn cache_complete(
    input: &SearchFeedViewInput,
    feed_id: &str,
    remote_query: Option<crate::QueryDemandInput>,
) -> (
    SearchFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let state = if input.window.visible_events().is_empty() {
        FeedFooterState::TerminalEmpty
    } else if input.window.has_older {
        FeedFooterState::OlderLoadReady
    } else {
        FeedFooterState::CacheHit
    };
    (
        SearchFeedStatus::Ready,
        remote_query,
        Some(footer_row(feed_id, state)),
    )
}

fn submitted_query(query: Option<&str>) -> Option<String> {
    query
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn diagnostic_rows(input: &SearchFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}
