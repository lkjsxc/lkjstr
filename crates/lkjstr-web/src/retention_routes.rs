#![doc = "Retention resource-kind to statement-id routes."]

use lkjstr_storage::{
    CacheResourceKind, RetentionDeleteIntent, SqliteRetentionClass, sqlite_schema_table,
};

pub(crate) enum DeleteRoute {
    Known(&'static [&'static str]),
    Protected,
    Unknown,
}

pub(crate) fn delete_route(intent: &RetentionDeleteIntent) -> DeleteRoute {
    if protected_table(&intent.table_name) {
        return DeleteRoute::Protected;
    }
    let Some(route) = route_for_kind(intent.resource_kind) else {
        return DeleteRoute::Unknown;
    };
    if route.table_name != intent.table_name {
        return DeleteRoute::Unknown;
    }
    DeleteRoute::Known(route.statements)
}

struct ResourceRoute {
    table_name: &'static str,
    statements: &'static [&'static str],
}

fn route_for_kind(kind: CacheResourceKind) -> Option<ResourceRoute> {
    let route = match kind {
        CacheResourceKind::NostrEvent => ResourceRoute {
            table_name: "events",
            statements: &[
                "event_tags.delete_by_event",
                "event_relays.delete_by_event",
                "events.delete",
            ],
        },
        CacheResourceKind::NotificationRecord => route("notifications", &["notifications.delete"]),
        CacheResourceKind::FeedCursor => route("feed_cursors", &["feed_cursors.delete"]),
        CacheResourceKind::CoverageRow => route("feed_coverage", &["feed_coverage.delete"]),
        CacheResourceKind::ScanHint => route("feed_scan_hints", &["feed_scan_hints.delete"]),
        CacheResourceKind::RelaySummary => route(
            "relay_diagnostic_summaries",
            &["relay_diagnostic_summaries.delete"],
        ),
        CacheResourceKind::RelayInfo => route("relay_information", &["relay_information.delete"]),
        CacheResourceKind::RelayReadObservation => route(
            "relay_read_observations",
            &["relay_read_observations.delete"],
        ),
        CacheResourceKind::RelayReadScore => {
            route("relay_read_scores", &["relay_read_scores.delete"])
        }
        CacheResourceKind::RelayListSuggestion => {
            route("relay_list_suggestions", &["relay_list_suggestions.delete"])
        }
        CacheResourceKind::AuthorRelayRoute => {
            route("author_relay_routes", &["author_relay_routes.delete"])
        }
        CacheResourceKind::RouteEvidenceScore => {
            route("route_evidence_scores", &["route_evidence_scores.delete"])
        }
        CacheResourceKind::JobRecord => route("jobs", &["jobs.delete"]),
        CacheResourceKind::TabState
        | CacheResourceKind::ScanObservation
        | CacheResourceKind::ScanDensityModel
        | CacheResourceKind::ScanDecisionTrace => return None,
    };
    Some(route)
}

fn route(table_name: &'static str, statements: &'static [&'static str]) -> ResourceRoute {
    ResourceRoute {
        table_name,
        statements,
    }
}

fn protected_table(table_name: &str) -> bool {
    sqlite_schema_table(table_name)
        .is_some_and(|table| table.retention == SqliteRetentionClass::Protected)
}
