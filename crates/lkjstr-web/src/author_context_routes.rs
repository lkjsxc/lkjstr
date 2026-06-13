use lkjstr_app::{AuthorContextFeedDiagnosticInput, FeedDiagnosticSeverity};
use lkjstr_protocol::normalize_relay_url;
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};
use lkjstr_storage::{AuthorRelayRouteRecord, StorageOutcome};

use crate::{
    author_context_host::AuthorContextHost, sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_author_routes_for_pubkey,
};

pub(crate) async fn author_routes(
    host: &AuthorContextHost,
    author_pubkey: &str,
    now_ms: u64,
) -> StorageOutcome<Vec<AuthorRelayRoute>> {
    let pubkey = author_pubkey.to_owned();
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

pub(crate) fn route_diagnostic(
    routes: &StorageOutcome<Vec<AuthorRelayRoute>>,
) -> Option<AuthorContextFeedDiagnosticInput> {
    let problem = routes.problem()?;
    Some(AuthorContextFeedDiagnosticInput {
        scope: "author-context-provider".to_owned(),
        id: "author-routes".to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: format!("Author Context routes unavailable: {}", problem.reason),
    })
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
