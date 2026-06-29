use crate::{
    EventDisplayContext, FeedFooterState, FeedLiveQueryInput, FeedStateRow, FeedViewModelInput,
    build_feed_view_model, diagnostic_state_row, footer_row, footer_row_from_window,
    home_live_query_input, unavailable_state_row,
};

use super::{
    HomeFeedSourceState, HomeFeedStatus, HomeFeedView, HomeFeedViewInput, HomeFollowState,
    account::active_home_account, defaults::home_authors,
};

#[must_use]
pub fn build_home_feed_view(input: HomeFeedViewInput) -> HomeFeedView {
    let feed_id = home_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let (status, live_query, footer_state) = match home_state(&input, &feed_id, &mut state_rows) {
        HomeBuildState::Blocked(state) => (state.status, None, Some(state.footer)),
        HomeBuildState::Ready { active_pubkey } => {
            ready_state(&input, active_pubkey, &feed_id, &mut state_rows)
        }
    };
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
    HomeFeedView {
        status,
        live_query,
        view_model,
    }
}

#[must_use]
pub fn home_feed_id(owner: &str) -> String {
    format!("home:{owner}")
}

enum HomeBuildState {
    Blocked(BlockedHomeState),
    Ready { active_pubkey: String },
}

struct BlockedHomeState {
    status: HomeFeedStatus,
    footer: crate::FeedFooterRow,
}

fn home_state(
    input: &HomeFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> HomeBuildState {
    let active_pubkey = match active_home_account(input, state_rows) {
        Ok(pubkey) => pubkey,
        Err(block) => return blocked(block.status, feed_id, block.footer),
    };
    if input.selected_relays.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            "home",
            "Home needs at least one enabled read relay.",
            true,
        ));
        return blocked(
            HomeFeedStatus::NoEnabledRelay,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    }
    match &input.follow_state {
        HomeFollowState::Loading => blocked(
            HomeFeedStatus::LoadingFollows,
            feed_id,
            FeedFooterState::Loading,
        ),
        HomeFollowState::MissingComplete => {
            state_rows.push(unavailable_state_row(
                "no-follow-list",
                &active_pubkey,
                "No public follow list was found for the selected account.",
                true,
            ));
            blocked(
                HomeFeedStatus::NoFollowList,
                feed_id,
                FeedFooterState::TerminalEmpty,
            )
        }
        HomeFollowState::Unavailable {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "follow-list-unavailable",
                &active_pubkey,
                reason,
                *retry_available,
            ));
            blocked(
                HomeFeedStatus::Unavailable,
                feed_id,
                FeedFooterState::RetryableFailure,
            )
        }
        HomeFollowState::Loaded { .. } => HomeBuildState::Ready { active_pubkey },
    }
}

fn ready_state(
    input: &HomeFeedViewInput,
    active_pubkey: String,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    HomeFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let HomeFollowState::Loaded { follow_pubkeys } = &input.follow_state else {
        unreachable!("ready state is only built after loaded follows")
    };
    let live_query = Some(home_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        authors: home_authors(&active_pubkey, follow_pubkeys),
        author_routes: input.author_routes.clone(),
        disabled_relays: input.disabled_relays.clone(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    }));
    match &input.source_state {
        HomeFeedSourceState::CacheComplete => {
            let state = if input.window.visible_events().is_empty() {
                FeedFooterState::TerminalEmpty
            } else {
                FeedFooterState::CacheHit
            };
            (
                HomeFeedStatus::Ready,
                live_query,
                Some(footer_row(feed_id, state)),
            )
        }
        HomeFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-home-coverage",
                "home",
                reason,
                *retry_available,
            ));
            (
                HomeFeedStatus::Partial,
                live_query,
                Some(footer_row(feed_id, FeedFooterState::Partial)),
            )
        }
        HomeFeedSourceState::Pending => (HomeFeedStatus::LoadingFeed, live_query, None),
        HomeFeedSourceState::RelayProgressive => (HomeFeedStatus::Ready, live_query, None),
    }
}

fn diagnostic_rows(input: &HomeFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}

fn blocked(status: HomeFeedStatus, feed_id: &str, footer_state: FeedFooterState) -> HomeBuildState {
    HomeBuildState::Blocked(BlockedHomeState {
        status,
        footer: footer_row(feed_id, footer_state),
    })
}
