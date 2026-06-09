#![doc = "SQLite repair probe statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const REPAIR_STATEMENTS: &[SqliteStatementSpec] = &[
    read(
        "events.repair_probe",
        "events",
        "SELECT 1 AS probe_present FROM events WHERE event_id = ?1 LIMIT 1;",
    ),
    read(
        "notifications.repair_probe",
        "notifications",
        "SELECT 1 AS probe_present FROM notifications WHERE notification_id = ?1 LIMIT 1;",
    ),
    read(
        "feed_cursors.repair_probe",
        "feed_cursors",
        "SELECT 1 AS probe_present FROM feed_cursors WHERE cursor_id = ?1 LIMIT 1;",
    ),
    read(
        "feed_coverage.repair_probe",
        "feed_coverage",
        "SELECT 1 AS probe_present FROM feed_coverage WHERE coverage_id = ?1 LIMIT 1;",
    ),
    read(
        "feed_scan_hints.repair_probe",
        "feed_scan_hints",
        "SELECT 1 AS probe_present FROM feed_scan_hints WHERE semantic_feed_key || char(31) || route_group_key || char(31) || relay_url || char(31) || semantic_filter_key || char(31) || direction || char(31) || route_fingerprint = ?1 LIMIT 1;",
    ),
    read(
        "relay_diagnostic_summaries.repair_probe",
        "relay_diagnostic_summaries",
        "SELECT 1 AS probe_present FROM relay_diagnostic_summaries WHERE relay_url = ?1 LIMIT 1;",
    ),
    read(
        "relay_information.repair_probe",
        "relay_information",
        "SELECT 1 AS probe_present FROM relay_information WHERE relay_url = ?1 LIMIT 1;",
    ),
    read(
        "relay_read_observations.repair_probe",
        "relay_read_observations",
        "SELECT 1 AS probe_present FROM relay_read_observations WHERE id = ?1 LIMIT 1;",
    ),
    read(
        "relay_read_scores.repair_probe",
        "relay_read_scores",
        "SELECT 1 AS probe_present FROM relay_read_scores WHERE relay_url || char(31) || surface || char(31) || phase || char(31) || direction || char(31) || route_group_key || char(31) || filter_shape || char(31) || purpose = ?1 LIMIT 1;",
    ),
    read(
        "relay_list_suggestions.repair_probe",
        "relay_list_suggestions",
        "SELECT 1 AS probe_present FROM relay_list_suggestions WHERE pubkey || ':' || relay_url || ':' || purpose = ?1 LIMIT 1;",
    ),
    read(
        "author_relay_routes.repair_probe",
        "author_relay_routes",
        "SELECT 1 AS probe_present FROM author_relay_routes WHERE pubkey || ':' || relay_url || ':' || route_kind = ?1 LIMIT 1;",
    ),
    read(
        "route_evidence_scores.repair_probe",
        "route_evidence_scores",
        "SELECT 1 AS probe_present FROM route_evidence_scores WHERE author_pubkey || char(31) || relay_url || char(31) || surface || char(31) || source = ?1 LIMIT 1;",
    ),
    read(
        "jobs.repair_probe",
        "jobs",
        "SELECT 1 AS probe_present FROM jobs WHERE job_id = ?1 LIMIT 1;",
    ),
];

const fn read(
    id: &'static str,
    table_name: &'static str,
    sql: &'static str,
) -> SqliteStatementSpec {
    SqliteStatementSpec {
        id,
        sql,
        table_name,
        operation: Op::Read,
    }
}
