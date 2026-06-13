use std::collections::BTreeMap;

use lkjstr_app::{UserTimelineFeedView, default_user_timeline_feed_view};
use lkjstr_relays::AuthorRelayRoute;
use lkjstr_storage::StorageOutcome;

use crate::{
    user_timeline_cache::{latest_follow_list, selected_relays},
    user_timeline_host::UserTimelineHost,
    user_timeline_host_cached::cached_model,
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
