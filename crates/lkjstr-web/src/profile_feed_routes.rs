use lkjstr_app::ProfileFeedDiagnosticInput;
use lkjstr_domain::{RelaySet, seed_relay_sets};
use lkjstr_protocol::normalize_relay_url;
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};
use lkjstr_storage::{AuthorRelayRouteRecord, StorageOutcome};

use crate::{
    host_status::browser_now_ms,
    profile_feed_host::ProfileFeedHost,
    profile_feed_status::diagnostic,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_author_routes_for_pubkey, sqlite_relay_sets_all},
};

pub(crate) async fn relay_sets(host: &ProfileFeedHost) -> StorageOutcome<Vec<RelaySet>> {
    let now = browser_now_ms();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => StorageOutcome::Ok(seed_relay_sets(&rows, now)),
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

pub(crate) async fn author_routes(
    host: &ProfileFeedHost,
    profile_pubkey: &str,
    now_ms: u64,
) -> StorageOutcome<Vec<AuthorRelayRoute>> {
    let pubkey = profile_pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_author_routes_for_pubkey(&store, &pubkey, now_ms).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(rows.into_iter().filter_map(route).collect())
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

pub(crate) fn query_selected_relays(
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
) -> Vec<String> {
    if author_routes.is_empty() {
        return selected_relays.to_vec();
    }
    Vec::new()
}

pub(crate) fn diagnostics(
    relay_message: Option<&str>,
    routes: &StorageOutcome<Vec<AuthorRelayRoute>>,
) -> Vec<ProfileFeedDiagnosticInput> {
    let mut out = Vec::new();
    if let Some(message) = relay_message {
        out.push(diagnostic("relay-settings", message));
    }
    if let Some(problem) = routes.problem() {
        out.push(diagnostic(
            "author-routes",
            &format!("Author routes unavailable: {}", problem.reason),
        ));
    }
    out
}

fn route(row: AuthorRelayRouteRecord) -> Option<AuthorRelayRoute> {
    let relay_url = normalize_relay_url(&row.relay_url)?;
    Some(AuthorRelayRoute {
        author: row.pubkey,
        relay_url,
        source: route_source(&row.route_kind)?,
        score: 0,
    })
}

fn route_source(key: &str) -> Option<RouteEvidenceSource> {
    Some(match key {
        "nip65" => RouteEvidenceSource::Nip65,
        "receipt" => RouteEvidenceSource::Receipt,
        "hint" => RouteEvidenceSource::Hint,
        "discovery" => RouteEvidenceSource::Discovery,
        "measured-author-success" => RouteEvidenceSource::MeasuredAuthorSuccess,
        "local-discovery-success" => RouteEvidenceSource::LocalDiscoverySuccess,
        _ => return None,
    })
}
