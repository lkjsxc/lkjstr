use std::collections::BTreeMap;

use lkjstr_app::{
    DiscoveryRouteOutcome, UserTimelineFeedDiagnosticInput, UserTimelineFeedSourceState,
    UserTimelineFeedView, empty_feed_window, user_timeline_author_set,
};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StorageOutcome;

use crate::{
    host_status::browser_now_ms,
    user_timeline_cache::{cached_events, window_from_events},
    user_timeline_coverage::{UserTimelineCoverageInput, load_user_timeline_source_state},
    user_timeline_discovery_view::{discovery_plan, discovery_plan_for_relay_outcomes},
    user_timeline_host::{PAGE_SIZE, UserTimelineHost, WINDOW_MAX},
    user_timeline_host_view::{
        UserTimelineModelParts, diagnostic, storage_problem, user_timeline_view,
    },
    user_timeline_relay_diagnostics::relay_diagnostics,
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
        diagnostics,
    })
}
