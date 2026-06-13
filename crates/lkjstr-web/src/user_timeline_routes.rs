use std::collections::BTreeSet;

use lkjstr_domain::RelaySet;
use lkjstr_protocol::normalize_relay_url;
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};
use lkjstr_storage::{AuthorRelayRouteRecord, StorageOutcome};

use crate::{
    host_status::browser_now_ms,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_author_routes_for_pubkey, sqlite_relay_sets_all},
    user_timeline_host::UserTimelineHost,
};

pub(crate) async fn author_routes(
    host: &UserTimelineHost,
    target_pubkey: &str,
) -> StorageOutcome<Vec<AuthorRelayRoute>> {
    let pubkey = target_pubkey.to_owned();
    let now_ms = browser_now_ms();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let disabled_relays = match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => disabled_relay_urls(&lkjstr_domain::seed_relay_sets(
                &rows, now_ms,
            )),
            _ => BTreeSet::new(),
        };
        match sqlite_author_routes_for_pubkey(&store, &pubkey, now_ms).await {
            StorageOutcome::Ok(rows) => StorageOutcome::Ok(
                rows.into_iter()
                    .filter_map(route)
                    .filter(|route| !disabled_relays.contains(&route.relay_url))
                    .collect(),
            ),
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

fn route(row: AuthorRelayRouteRecord) -> Option<AuthorRelayRoute> {
    Some(AuthorRelayRoute {
        author: row.pubkey,
        relay_url: normalize_relay_url(&row.relay_url)?,
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

fn disabled_relay_urls(sets: &[RelaySet]) -> BTreeSet<String> {
    let mut enabled = BTreeSet::new();
    let mut disabled = BTreeSet::new();
    for relay in sets.iter().flat_map(|set| set.relays.iter()) {
        let Some(url) = normalize_relay_url(&relay.url) else {
            continue;
        };
        if relay.enabled {
            enabled.insert(url);
        } else {
            disabled.insert(url);
        }
    }
    disabled.difference(&enabled).cloned().collect()
}
