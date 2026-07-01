use crate::{
    EventDisplayContext, FeedFooterState, FeedStateRow, FeedViewModelInput, ProfileLiveQueryInput,
    build_feed_view_model, diagnostic_state_row, footer_row, footer_row_from_window,
    profile_live_query_input, unavailable_state_row,
};

use super::{
    ProfileFeedSourceState, ProfileFeedStatus, ProfileFeedView, ProfileFeedViewInput,
    policy::profile_startup_decision,
};

type ProfileStateResult = (
    ProfileFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
);

#[must_use]
pub fn build_profile_feed_view(input: ProfileFeedViewInput) -> ProfileFeedView {
    let feed_id = profile_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let (status, live_query, footer_state) = profile_state(&input, &feed_id, &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let profile_header =
        super::profile_header_or_default(input.profile_header, input.profile_pubkey.as_deref())
            .map(|header| {
                super::profile_header_with_copy_context(
                    header,
                    &input.profile_hint_relays,
                    &input.relay_sets_json,
                )
            });
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::Profile,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    ProfileFeedView {
        status,
        live_query,
        profile_header,
        view_model,
    }
}

#[must_use]
pub fn profile_feed_id(owner: &str) -> String {
    format!("profile:{owner}")
}

fn profile_state(
    input: &ProfileFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> ProfileStateResult {
    let Some(profile_pubkey) = input.profile_pubkey.clone() else {
        state_rows.push(unavailable_state_row(
            "missing-profile-pubkey",
            "profile",
            "Profile needs a target pubkey before reading authored notes.",
            false,
        ));
        return blocked(
            ProfileFeedStatus::MissingPubkey,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    };
    if profile_startup_decision(input).action
        == crate::read_availability::surface_startup_policy::SurfaceStartupAction::Blocked
    {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            &profile_pubkey,
            "Profile needs at least one enabled read relay or author route.",
            true,
        ));
        return blocked(
            ProfileFeedStatus::NoEnabledRelay,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    }
    ready_state(input, profile_pubkey, feed_id, state_rows)
}

fn ready_state(
    input: &ProfileFeedViewInput,
    profile_pubkey: String,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> ProfileStateResult {
    let live_query = Some(profile_live_query_input(ProfileLiveQueryInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        profile_pubkey,
        author_routes: input.author_routes.clone(),
        disabled_relays: input.disabled_relays.clone(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    }));
    match &input.source_state {
        ProfileFeedSourceState::CacheComplete => {
            if input.window.visible_events().is_empty() {
                return searching_older_state(
                    state_rows,
                    feed_id,
                    "Profile history absence is not proven by the recent cache window.",
                    live_query,
                );
            }
            (
                ProfileFeedStatus::Ready,
                live_query,
                Some(footer_row(feed_id, FeedFooterState::CacheHit)),
            )
        }
        ProfileFeedSourceState::SearchingOlder {
            since,
            until,
            span_seconds,
        } => searching_older_state(
            state_rows,
            feed_id,
            &format!(
                "Scanning older Profile history from {since} to {until} with a {span_seconds}s span."
            ),
            live_query,
        ),
        ProfileFeedSourceState::EmptyProven => (
            ProfileFeedStatus::Ready,
            live_query,
            Some(footer_row(feed_id, FeedFooterState::TerminalEmpty)),
        ),
        ProfileFeedSourceState::Partial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-profile-coverage",
                "profile",
                reason,
                *retry_available,
            ));
            (
                ProfileFeedStatus::Partial,
                live_query,
                Some(footer_row(feed_id, FeedFooterState::Partial)),
            )
        }
        ProfileFeedSourceState::Pending => (ProfileFeedStatus::Loading, live_query, None),
        ProfileFeedSourceState::RelayProgressive => (ProfileFeedStatus::Ready, live_query, None),
    }
}

fn searching_older_state(
    state_rows: &mut Vec<FeedStateRow>,
    feed_id: &str,
    detail: &str,
    live_query: Option<crate::QueryDemandInput>,
) -> ProfileStateResult {
    state_rows.push(unavailable_state_row(
        "searching-older-profile-history",
        "profile",
        detail,
        true,
    ));
    (
        ProfileFeedStatus::Partial,
        live_query,
        Some(footer_row(feed_id, FeedFooterState::ReadingRelays)),
    )
}

fn diagnostic_rows(input: &ProfileFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}

fn blocked(
    status: ProfileFeedStatus,
    feed_id: &str,
    footer_state: FeedFooterState,
) -> ProfileStateResult {
    (status, None, Some(footer_row(feed_id, footer_state)))
}
