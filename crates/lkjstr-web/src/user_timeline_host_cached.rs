use std::collections::BTreeMap;

use lkjstr_app::{
    DiscoveryRouteOutcome, UserTimelineFeedDiagnosticInput, UserTimelineFeedSourceState,
    UserTimelineFeedView, empty_feed_window, target_posts_only_author_set,
    user_timeline_author_set,
};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StorageOutcome;

use crate::{
    host_status::browser_now_ms,
    user_timeline_cache::{cached_events, window_from_events},
    user_timeline_coverage::{UserTimelineCoverageInput, load_user_timeline_source_state},
    user_timeline_discovery_view::{
        discovery_plan, discovery_plan_for_relay_outcomes,
        discovery_plan_for_relay_outcomes_with_target_posts,
    },
    user_timeline_geometry::user_timeline_geometry_models,
    user_timeline_host::{PAGE_SIZE, UserTimelineHost, WINDOW_MAX},
    user_timeline_host_view::{
        UserTimelineModelParts, diagnostic, relay_failure_view, storage_problem,
        user_timeline_view,
    },
    user_timeline_relay_diagnostics::relay_diagnostics,
    user_timeline_relay_input::{UserTimelineRelayReadInput, UserTimelineTargetPostsFallback},
    user_timeline_relay_outcome::UserTimelineRelayOutcome,
};

pub(crate) async fn cached_model(
    host: &UserTimelineHost,
    owner: &str,
    follow_list: lkjstr_protocol::NostrEvent,
    selected_relays: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    mut diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
    relay_outcomes: Option<BTreeMap<String, UserTimelineRelayOutcome>>,
) -> UserTimelineFeedView {
    let target = follow_list.pubkey.clone();
    let author_set = user_timeline_author_set(&target, Some(&follow_list));
    let now_sec = browser_now_ms() / 1_000;
    let since = now_sec.saturating_sub(30);
    let events = cached_events(host, &author_set.authors).await;
    let (window, source_state) = match events {
        StorageOutcome::Ok(events) => {
            let source_state = load_user_timeline_source_state(
                host,
                UserTimelineCoverageInput {
                    owner,
                    authors: &author_set.authors,
                    selected_relays: &selected_relays,
                    author_routes: &author_routes,
                    since,
                    until: now_sec,
                    page_size: PAGE_SIZE,
                },
            )
            .await;
            (window_from_events(events), source_state)
        }
        outcome => {
            let reason = storage_problem("Cached User Timeline events unavailable", outcome);
            diagnostics.push(diagnostic("cache-events", &reason));
            (
                empty_feed_window(1, WINDOW_MAX),
                UserTimelineFeedSourceState::Partial {
                    reason,
                    retry_available: true,
                },
            )
        }
    };
    if let Some(outcomes) = &relay_outcomes {
        diagnostics.extend(relay_diagnostics(&selected_relays, &author_routes, outcomes));
    }
    let geometry_models =
        user_timeline_geometry_models(host, &window, &mut diagnostics, 680, 1.0).await;
    let discovery = relay_outcomes.as_ref().map_or_else(
        || {
            discovery_plan(
                selected_relays.clone(),
                &author_routes,
                DiscoveryRouteOutcome::Succeeded,
                true,
            )
        },
        |outcomes| {
            discovery_plan_for_relay_outcomes(
                selected_relays.clone(),
                &author_routes,
                outcomes,
                true,
            )
        },
    );
    user_timeline_view(UserTimelineModelParts {
        owner,
        target_pubkey: Some(target),
        discovery,
        author_set: Some(author_set),
        source_state,
        selected_relays,
        author_routes,
        window,
        since: Some(since),
        geometry_models,
        diagnostics,
    })
}

pub(crate) async fn target_posts_fallback(
    host: &UserTimelineHost,
    owner: &str,
    target_pubkey: &str,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    mut diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
) -> Option<UserTimelineTargetPostsFallback> {
    let authors = vec![target_pubkey.to_owned()];
    let events = match cached_events(host, &authors).await {
        StorageOutcome::Ok(events) if !events.is_empty() => events,
        _ => return None,
    };
    let now_sec = browser_now_ms() / 1_000;
    let since = now_sec.saturating_sub(30);
    let window = window_from_events(events);
    let source_state = load_user_timeline_source_state(
        host,
        UserTimelineCoverageInput {
            owner,
            authors: &authors,
            selected_relays,
            author_routes,
            since,
            until: now_sec,
            page_size: PAGE_SIZE,
        },
    )
    .await;
    let geometry_models =
        user_timeline_geometry_models(host, &window, &mut diagnostics, 680, 1.0).await;
    Some(UserTimelineTargetPostsFallback {
        window,
        source_state,
        since: Some(since),
        geometry_models,
        diagnostics,
    })
}

pub(crate) fn user_timeline_no_event_view(
    input: &UserTimelineRelayReadInput,
    relay_outcomes: BTreeMap<String, UserTimelineRelayOutcome>,
) -> UserTimelineFeedView {
    let Some(fallback) = &input.target_posts_fallback else {
        return relay_failure_view(
            &input.owner,
            Some(input.target_pubkey.clone()),
            input.selected_relays.clone(),
            input.author_routes.clone(),
            relay_outcomes,
        );
    };
    let mut diagnostics = fallback.diagnostics.clone();
    diagnostics.extend(relay_diagnostics(
        &input.selected_relays,
        &input.author_routes,
        &relay_outcomes,
    ));
    user_timeline_view(UserTimelineModelParts {
        owner: &input.owner,
        target_pubkey: Some(input.target_pubkey.clone()),
        discovery: discovery_plan_for_relay_outcomes_with_target_posts(
            input.selected_relays.clone(),
            &input.author_routes,
            &relay_outcomes,
            false,
            true,
        ),
        author_set: Some(target_posts_only_author_set(&input.target_pubkey)),
        source_state: fallback.source_state.clone(),
        selected_relays: input.selected_relays.clone(),
        author_routes: input.author_routes.clone(),
        window: fallback.window.clone(),
        since: fallback.since,
        geometry_models: fallback.geometry_models.clone(),
        diagnostics,
    })
}
