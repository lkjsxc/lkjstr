use std::collections::BTreeMap;

use lkjstr_app::{UserTimelineFeedView, default_user_timeline_feed_view};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StorageOutcome;

use crate::{
    effective_public_relays::effective_public_read_relays,
    host_status::browser_now_ms,
    user_timeline_cache::latest_follow_list,
    user_timeline_host::UserTimelineHost,
    user_timeline_host_cached::{cached_model, target_posts_fallback, user_timeline_no_event_view},
    user_timeline_host_view::{
        diagnostic, diagnostics, loading_selected_model, partial_failure_view, storage_problem,
    },
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
    let relays = effective_public_read_relays(&host.db_name, &host.worker_url, browser_now_ms()).await;
    let mut diagnostics = diagnostics(relays.diagnostic.as_deref());
    let selected = relays.relays;
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
            let fallback = target_posts_fallback(
                host,
                owner,
                &target,
                &selected,
                &author_routes,
                diagnostics.clone(),
            )
            .await;
            if let (Some(outcomes), Some(_)) = (&relay_outcomes, &fallback)
                && let Some(input) = relay_input_with_fallback(
                    owner,
                    &target,
                    &selected,
                    &author_routes,
                    fallback.clone(),
                )
            {
                return loaded(user_timeline_no_event_view(&input, outcomes.clone()), None);
            }
            let model =
                loading_selected_model(owner, target_pubkey, &selected, &author_routes, diagnostics);
            let relay =
                relay_input_with_fallback(owner, &target, &selected, &author_routes, fallback);
            loaded(model, relay)
        }
        outcome => {
            let reason = storage_problem("Cached User Timeline follow list unavailable", outcome);
            diagnostics.push(diagnostic("cache-follow-list", &reason));
            let relay = relay_input_with_fallback(owner, &target, &selected, &author_routes, None);
            loaded(partial_failure_view(owner, target_pubkey, reason, diagnostics), relay)
        }
    }
}

#[cfg(debug_assertions)]
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

fn relay_input_with_fallback(
    owner: &str,
    target_pubkey: &str,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    fallback: Option<crate::user_timeline_relay_input::UserTimelineTargetPostsFallback>,
) -> Option<UserTimelineRelayReadInput> {
    let mut input = user_timeline_relay_input(owner, target_pubkey, selected_relays, author_routes)?;
    input.target_posts_fallback = fallback;
    Some(input)
}

fn loaded(model: UserTimelineFeedView, relay: Option<UserTimelineRelayReadInput>) -> UserTimelineLoad {
    UserTimelineLoad { model, relay }
}
