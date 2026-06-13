use std::collections::BTreeMap;
use lkjstr_app::{
    DiscoveryRouteOutcome, UserTimelineFeedDiagnosticInput, UserTimelineFeedSourceState,
    UserTimelineFeedView, default_user_timeline_feed_view, empty_feed_window,
    user_timeline_author_set,
};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StorageOutcome;

use crate::{
    host_status::browser_now_ms,
    user_timeline_cache::{cached_events, latest_follow_list, selected_relays, window_from_events},
    user_timeline_discovery_view::{discovery_plan, discovery_plan_for_relay_outcomes},
    user_timeline_host::{UserTimelineHost, WINDOW_MAX},
    user_timeline_host_view::{
        PARTIAL_CACHE_REASON, UserTimelineModelParts, diagnostic, diagnostics,
        loading_selected_model, partial_failure_view, storage_problem, user_timeline_view,
    },
    user_timeline_relay_diagnostics::relay_diagnostics,
    user_timeline_relay_input::{UserTimelineRelayInputSeed, UserTimelineRelayReadInput},
    user_timeline_relay_outcome::UserTimelineRelayOutcome,
    user_timeline_routes::author_routes,
};

pub(crate) struct UserTimelineLoad {
    pub(crate) model: UserTimelineFeedView,
    pub(crate) relay: Option<UserTimelineRelayReadInput>,
}

pub(crate) async fn user_timeline_load(
    host: &UserTimelineHost,
    owner: &str,
    target_pubkey: Option<String>,
) -> UserTimelineLoad {
    user_timeline_load_with_outcomes(host, owner, target_pubkey, None).await
}

async fn user_timeline_load_with_outcomes(
    host: &UserTimelineHost,
    owner: &str,
    target_pubkey: Option<String>,
    relay_outcomes: Option<BTreeMap<String, UserTimelineRelayOutcome>>,
) -> UserTimelineLoad {
    let Some(target) = target_pubkey.clone() else {
        return loaded(default_user_timeline_feed_view(owner, None), None);
    };
    let relays = selected_relays(host).await;
    let mut diagnostics = diagnostics(&relays);
    let selected = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let routes = author_routes(host, &target).await;
    if let Some(problem) = routes.problem() {
        diagnostics.push(diagnostic(
            "author-routes",
            &format!("User Timeline author routes unavailable: {}", problem.reason),
        ));
    }
    let author_routes = match routes {
        StorageOutcome::Ok(routes) => routes,
        _ => Vec::new(),
    };
    match latest_follow_list(host, &target).await {
        StorageOutcome::Ok(Some(row)) => loaded(
            cached_model(
                host,
                owner,
                row.event,
                selected,
                author_routes,
                diagnostics,
                relay_outcomes,
            )
            .await,
            None,
        ),
        StorageOutcome::Ok(None) => {
            let model =
                loading_selected_model(owner, target_pubkey, &selected, &author_routes, diagnostics);
            let relay = user_timeline_relay_input(owner, &target, &selected, &author_routes);
            loaded(model, relay)
        }
        outcome => {
            let reason = storage_problem("Cached User Timeline follow list unavailable", outcome);
            diagnostics.push(diagnostic("cache-follow-list", &reason));
            loaded(partial_failure_view(owner, target_pubkey, reason, diagnostics), None)
        }
    }
}

pub(crate) async fn user_timeline_model(
    host: &UserTimelineHost,
    owner: &str,
    target_pubkey: Option<String>,
) -> UserTimelineFeedView {
    user_timeline_load_with_outcomes(host, owner, target_pubkey, None)
        .await
        .model
}

pub(crate) async fn user_timeline_model_with_relay_outcomes(
    host: &UserTimelineHost,
    owner: &str,
    target_pubkey: Option<String>,
    relay_outcomes: BTreeMap<String, UserTimelineRelayOutcome>,
) -> UserTimelineFeedView {
    user_timeline_load_with_outcomes(host, owner, target_pubkey, Some(relay_outcomes))
        .await
        .model
}

async fn cached_model(
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
    let events = cached_events(host, &author_set.authors).await;
    let (window, source_state) = match events {
        StorageOutcome::Ok(events) => (
            window_from_events(events),
            UserTimelineFeedSourceState::Partial {
                reason: PARTIAL_CACHE_REASON.to_owned(),
                retry_available: true,
            },
        ),
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
        since: Some((browser_now_ms() / 1_000).saturating_sub(30)),
        diagnostics,
    })
}

fn user_timeline_relay_input(
    owner: &str,
    target_pubkey: &str,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
) -> Option<UserTimelineRelayReadInput> {
    crate::user_timeline_relay_input::user_timeline_relay_input(UserTimelineRelayInputSeed {
        owner,
        target_pubkey,
        selected_relays,
        author_routes,
    })
}

fn loaded(model: UserTimelineFeedView, relay: Option<UserTimelineRelayReadInput>) -> UserTimelineLoad {
    UserTimelineLoad { model, relay }
}
