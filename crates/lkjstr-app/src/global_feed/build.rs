use crate::{
    EventDisplayContext, FeedFooterState, FeedLiveQueryInput, FeedStateRow, FeedViewModelInput,
    build_feed_view_model, diagnostic_state_row, footer_row, footer_row_from_window,
    global_live_query_input, unavailable_state_row,
};

use super::{GlobalFeedSourceState, GlobalFeedStatus, GlobalFeedView, GlobalFeedViewInput};

#[must_use]
pub fn build_global_feed_view(input: GlobalFeedViewInput) -> GlobalFeedView {
    let feed_id = global_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let (status, live_query, footer_state) = global_state(&input, &feed_id, &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::Timeline,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    GlobalFeedView {
        status,
        live_query,
        view_model,
    }
}

#[must_use]
pub fn global_feed_id(owner: &str) -> String {
    format!("global:{owner}")
}

fn global_state(
    input: &GlobalFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    GlobalFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    if input.selected_relays.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            "global",
            "Global needs at least one enabled read relay.",
            true,
        ));
        return (
            GlobalFeedStatus::NoEnabledRelay,
            None,
            Some(footer_row(
                feed_id,
                FeedFooterState::ConfigurationUnavailable,
            )),
        );
    }
    ready_state(input, feed_id, state_rows)
}

fn ready_state(
    input: &GlobalFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    GlobalFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let live_query = Some(global_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: input.disabled_relays.clone(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    }));
    match &input.source_state {
        GlobalFeedSourceState::CacheComplete => {
            let state = if input.window.visible_events().is_empty() {
                FeedFooterState::TerminalEmpty
            } else {
                FeedFooterState::CacheHit
            };
            (
                GlobalFeedStatus::Ready,
                live_query,
                Some(footer_row(feed_id, state)),
            )
        }
        GlobalFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-global-coverage",
                "global",
                reason,
                *retry_available,
            ));
            (
                GlobalFeedStatus::Partial,
                live_query,
                Some(footer_row(feed_id, FeedFooterState::Partial)),
            )
        }
        GlobalFeedSourceState::Pending => (GlobalFeedStatus::Loading, live_query, None),
        GlobalFeedSourceState::RelayProgressive => (GlobalFeedStatus::Ready, live_query, None),
    }
}

fn diagnostic_rows(input: &GlobalFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}
