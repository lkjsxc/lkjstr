use crate::{
    FeedFooterRow, FeedFooterState, FeedLiveQueryInput, FeedStateRow, QueryDemandInput,
    UserTimelineAuthorSet, diagnostic_state_row, footer_row, target_posts_only_author_set,
    unavailable_state_row, user_timeline_live_query_input,
};

use super::{
    UserTimelineDiscoveryState, UserTimelineFeedSourceState, UserTimelineFeedStatus,
    UserTimelineFeedViewInput,
};

const TARGET_ONLY_NOTICE: &str =
    "Public follow graph unavailable; showing this user's own public posts.";

pub(super) type TimelineState = (
    UserTimelineFeedStatus,
    Option<QueryDemandInput>,
    Option<UserTimelineAuthorSet>,
    Option<FeedFooterRow>,
);
#[must_use]
pub const fn user_timeline_target_only_notice() -> &'static str {
    TARGET_ONLY_NOTICE
}

pub(super) fn user_timeline_state(
    input: &UserTimelineFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> TimelineState {
    let Some(target_pubkey) = input.target_pubkey.clone() else {
        state_rows.push(unavailable_state_row(
            "missing-user-timeline-pubkey",
            "user-timeline",
            "User Timeline needs a target pubkey before reading public notes.",
            false,
        ));
        return blocked(
            UserTimelineFeedStatus::MissingPubkey,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    };
    if is_loading(input.discovery.state) {
        return blocked(
            UserTimelineFeedStatus::LoadingDiscovery,
            feed_id,
            FeedFooterState::Loading,
        );
    }
    if input.selected_relays.is_empty() && input.author_routes.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-user-timeline-relay",
            "user-timeline",
            "User Timeline needs at least one enabled read relay or author route.",
            true,
        ));
        return blocked(
            UserTimelineFeedStatus::NoEnabledRelay,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    }
    match input.discovery.state {
        UserTimelineDiscoveryState::Partial => {
            ready(input, feed_id, state_rows, target_pubkey, false)
        }
        UserTimelineDiscoveryState::TargetPostsOnly => {
            ready(input, feed_id, state_rows, target_pubkey, true)
        }
        UserTimelineDiscoveryState::AuthRequired => blocked(
            UserTimelineFeedStatus::AuthRequired,
            feed_id,
            FeedFooterState::AuthRequired,
        ),
        UserTimelineDiscoveryState::RateLimited => blocked(
            UserTimelineFeedStatus::RateLimited,
            feed_id,
            FeedFooterState::RetryableFailure,
        ),
        UserTimelineDiscoveryState::Offline => blocked(
            UserTimelineFeedStatus::Offline,
            feed_id,
            FeedFooterState::RetryableFailure,
        ),
        UserTimelineDiscoveryState::Failed => blocked(
            UserTimelineFeedStatus::Failed,
            feed_id,
            FeedFooterState::RetryableFailure,
        ),
        UserTimelineDiscoveryState::Incomplete => blocked(
            UserTimelineFeedStatus::Incomplete,
            feed_id,
            FeedFooterState::Partial,
        ),
        _ => unreachable!("loading states returned before readiness checks"),
    }
}

pub(super) fn diagnostic_rows(input: &UserTimelineFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}

fn ready(
    input: &UserTimelineFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
    target_pubkey: String,
    target_only: bool,
) -> TimelineState {
    let author_set = input
        .author_set
        .clone()
        .unwrap_or_else(|| target_posts_only_author_set(&target_pubkey));
    if target_only {
        state_rows.push(unavailable_state_row(
            "target-posts-only",
            "user-timeline",
            TARGET_ONLY_NOTICE,
            true,
        ));
    }
    let query = Some(user_timeline_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        authors: author_set.authors.clone(),
        author_routes: input.author_routes.clone(),
        disabled_relays: input.disabled_relays.clone(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    }));
    let (status, footer) = source_status(input, feed_id, target_only, state_rows);
    (status, query, Some(author_set), footer)
}

fn source_status(
    input: &UserTimelineFeedViewInput,
    feed_id: &str,
    target_only: bool,
    state_rows: &mut Vec<FeedStateRow>,
) -> (UserTimelineFeedStatus, Option<FeedFooterRow>) {
    match &input.source_state {
        UserTimelineFeedSourceState::CacheComplete => (
            UserTimelineFeedStatus::for_target_mode(target_only),
            Some(footer_row(
                feed_id,
                if input.window.visible_events().is_empty() {
                    FeedFooterState::TerminalEmpty
                } else {
                    FeedFooterState::CacheHit
                },
            )),
        ),
        UserTimelineFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-user-timeline",
                "user-timeline",
                reason,
                *retry_available,
            ));
            (
                UserTimelineFeedStatus::Partial,
                Some(footer_row(feed_id, FeedFooterState::Partial)),
            )
        }
        UserTimelineFeedSourceState::Pending => (UserTimelineFeedStatus::LoadingFeed, None),
        UserTimelineFeedSourceState::RelayProgressive => {
            (UserTimelineFeedStatus::for_target_mode(target_only), None)
        }
    }
}

fn is_loading(state: UserTimelineDiscoveryState) -> bool {
    matches!(
        state,
        UserTimelineDiscoveryState::NotStarted
            | UserTimelineDiscoveryState::LoadingCache
            | UserTimelineDiscoveryState::LoadingSelectedRelays
            | UserTimelineDiscoveryState::LoadingTargetRoutes
            | UserTimelineDiscoveryState::LoadingNip65Routes
            | UserTimelineDiscoveryState::LoadingProvenanceRoutes
    )
}

fn blocked(
    status: UserTimelineFeedStatus,
    feed_id: &str,
    footer_state: FeedFooterState,
) -> TimelineState {
    (status, None, None, Some(footer_row(feed_id, footer_state)))
}
