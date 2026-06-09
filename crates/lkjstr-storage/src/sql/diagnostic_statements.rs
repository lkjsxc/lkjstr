#![doc = "SQLite diagnostics repository statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const DIAGNOSTIC_STATEMENTS: &[SqliteStatementSpec] = &[
    read(
        "relay_information.select",
        "relay_information",
        "SELECT relay_url, info_json, fetched_at_ms, updated_at_ms FROM relay_information WHERE relay_url = ?1;",
    ),
    read(
        "relay_information.recent",
        "relay_information",
        "SELECT relay_url, info_json, fetched_at_ms, updated_at_ms FROM relay_information ORDER BY fetched_at_ms DESC, relay_url ASC LIMIT ?1;",
    ),
    write(
        "relay_information.upsert",
        "relay_information",
        "INSERT INTO relay_information (relay_url, info_json, fetched_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(relay_url) DO UPDATE SET info_json = excluded.info_json, fetched_at_ms = excluded.fetched_at_ms, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "relay_diagnostic_summaries.select",
        "relay_diagnostic_summaries",
        "SELECT relay_url, summary_json, updated_at_ms FROM relay_diagnostic_summaries WHERE relay_url = ?1;",
    ),
    read(
        "relay_diagnostic_summaries.recent",
        "relay_diagnostic_summaries",
        "SELECT relay_url, summary_json, updated_at_ms FROM relay_diagnostic_summaries ORDER BY updated_at_ms DESC, relay_url ASC LIMIT ?1;",
    ),
    write(
        "relay_diagnostic_summaries.upsert",
        "relay_diagnostic_summaries",
        "INSERT INTO relay_diagnostic_summaries (relay_url, summary_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(relay_url) DO UPDATE SET summary_json = excluded.summary_json, updated_at_ms = excluded.updated_at_ms;",
    ),
    write(
        "relay_read_observations.insert",
        "relay_read_observations",
        "INSERT INTO relay_read_observations (id, relay_url, surface, phase, direction, route_group_key, semantic_feed_key, semantic_filter_key, purpose, started_at_ms, first_event_ms, eose_ms, duration_ms, event_count, unique_event_count, final_count, timeout, closed, auth, socket_error, event_limit_reached, bytes_sent, bytes_received, route_evidence_sources_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25);",
    ),
    write(
        "relay_read_observations.delete_old",
        "relay_read_observations",
        "DELETE FROM relay_read_observations WHERE created_at_ms < ?1 OR id IN (SELECT id FROM relay_read_observations ORDER BY created_at_ms DESC LIMIT -1 OFFSET ?2);",
    ),
    read(
        "relay_read_scores.select",
        "relay_read_scores",
        "SELECT relay_url, surface, phase, direction, route_group_key, filter_shape, purpose, reliability, first_event_speed, eose_speed, useful_yield, unique_yield, penalty, fairness_credit, sample_count, updated_at_ms FROM relay_read_scores WHERE relay_url = ?1 AND surface = ?2 AND phase = ?3 AND direction = ?4 AND route_group_key = ?5 AND filter_shape = ?6 AND purpose = ?7;",
    ),
    write(
        "relay_read_scores.upsert",
        "relay_read_scores",
        "INSERT INTO relay_read_scores (relay_url, surface, phase, direction, route_group_key, filter_shape, purpose, reliability, first_event_speed, eose_speed, useful_yield, unique_yield, penalty, fairness_credit, sample_count, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16) ON CONFLICT(relay_url, surface, phase, direction, route_group_key, filter_shape, purpose) DO UPDATE SET reliability = excluded.reliability, first_event_speed = excluded.first_event_speed, eose_speed = excluded.eose_speed, useful_yield = excluded.useful_yield, unique_yield = excluded.unique_yield, penalty = excluded.penalty, fairness_credit = excluded.fairness_credit, sample_count = excluded.sample_count, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "relay_list_suggestions.by_pubkey",
        "relay_list_suggestions",
        "SELECT pubkey, relay_url, purpose, source_event_id, updated_at_ms FROM relay_list_suggestions WHERE pubkey = ?1 ORDER BY relay_url ASC, purpose ASC;",
    ),
    write(
        "relay_list_suggestions.upsert",
        "relay_list_suggestions",
        "INSERT INTO relay_list_suggestions (pubkey, relay_url, purpose, source_event_id, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(pubkey, relay_url, purpose) DO UPDATE SET source_event_id = excluded.source_event_id, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "author_relay_routes.by_pubkey",
        "author_relay_routes",
        "SELECT pubkey, relay_url, route_kind, evidence_json, updated_at_ms, expires_at_ms FROM author_relay_routes WHERE pubkey = ?1 AND (expires_at_ms IS NULL OR expires_at_ms > ?2) ORDER BY updated_at_ms DESC, relay_url ASC;",
    ),
    write(
        "author_relay_routes.upsert",
        "author_relay_routes",
        "INSERT INTO author_relay_routes (pubkey, relay_url, route_kind, evidence_json, updated_at_ms, expires_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(pubkey, relay_url, route_kind) DO UPDATE SET evidence_json = excluded.evidence_json, updated_at_ms = excluded.updated_at_ms, expires_at_ms = excluded.expires_at_ms;",
    ),
    read(
        "route_evidence_scores.by_author",
        "route_evidence_scores",
        "SELECT author_pubkey, relay_url, surface, source, source_confidence, measured_success, measured_failure, last_success_at_ms, last_failure_at_ms, updated_at_ms FROM route_evidence_scores WHERE author_pubkey = ?1 AND surface = ?2 ORDER BY updated_at_ms DESC, relay_url ASC;",
    ),
    write(
        "route_evidence_scores.upsert",
        "route_evidence_scores",
        "INSERT INTO route_evidence_scores (author_pubkey, relay_url, surface, source, source_confidence, measured_success, measured_failure, last_success_at_ms, last_failure_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(author_pubkey, relay_url, surface, source) DO UPDATE SET source_confidence = excluded.source_confidence, measured_success = excluded.measured_success, measured_failure = excluded.measured_failure, last_success_at_ms = excluded.last_success_at_ms, last_failure_at_ms = excluded.last_failure_at_ms, updated_at_ms = excluded.updated_at_ms;",
    ),
    read(
        "relay_route_blocks.recent",
        "relay_route_blocks",
        "SELECT relay_url, pubkey, reason, created_at_ms FROM relay_route_blocks ORDER BY created_at_ms DESC, relay_url ASC LIMIT ?1;",
    ),
    write(
        "relay_route_blocks.upsert",
        "relay_route_blocks",
        "INSERT INTO relay_route_blocks (relay_url, pubkey, reason, created_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(relay_url, pubkey) DO UPDATE SET reason = excluded.reason, created_at_ms = excluded.created_at_ms;",
    ),
    write(
        "relay_route_blocks.delete",
        "relay_route_blocks",
        "DELETE FROM relay_route_blocks WHERE relay_url = ?1 AND pubkey = ?2;",
    ),
    read(
        "jobs.select",
        "jobs",
        "SELECT job_id, job_kind, state, owner_id, payload_json, created_at_ms, updated_at_ms, finished_at_ms FROM jobs WHERE job_id = ?1;",
    ),
    read(
        "jobs.recent",
        "jobs",
        "SELECT job_id, job_kind, state, owner_id, payload_json, created_at_ms, updated_at_ms, finished_at_ms FROM jobs ORDER BY updated_at_ms DESC, job_id ASC LIMIT ?1;",
    ),
    write(
        "jobs.upsert",
        "jobs",
        "INSERT INTO jobs (job_id, job_kind, state, owner_id, payload_json, created_at_ms, updated_at_ms, finished_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(job_id) DO UPDATE SET job_kind = excluded.job_kind, state = excluded.state, owner_id = excluded.owner_id, payload_json = excluded.payload_json, updated_at_ms = excluded.updated_at_ms, finished_at_ms = excluded.finished_at_ms;",
    ),
    write(
        "relay_diagnostic_summaries.delete",
        "relay_diagnostic_summaries",
        "DELETE FROM relay_diagnostic_summaries WHERE relay_url = ?1;",
    ),
    write(
        "relay_information.delete",
        "relay_information",
        "DELETE FROM relay_information WHERE relay_url = ?1;",
    ),
    write(
        "relay_read_observations.delete",
        "relay_read_observations",
        "DELETE FROM relay_read_observations WHERE id = ?1;",
    ),
    write(
        "relay_read_scores.delete",
        "relay_read_scores",
        "DELETE FROM relay_read_scores WHERE relay_url || char(31) || surface || char(31) || phase || char(31) || direction || char(31) || route_group_key || char(31) || filter_shape || char(31) || purpose = ?1;",
    ),
    write(
        "relay_list_suggestions.delete",
        "relay_list_suggestions",
        "DELETE FROM relay_list_suggestions WHERE pubkey || ':' || relay_url || ':' || purpose = ?1;",
    ),
    write(
        "author_relay_routes.delete",
        "author_relay_routes",
        "DELETE FROM author_relay_routes WHERE pubkey || ':' || relay_url || ':' || route_kind = ?1;",
    ),
    write(
        "route_evidence_scores.delete",
        "route_evidence_scores",
        "DELETE FROM route_evidence_scores WHERE author_pubkey || char(31) || relay_url || char(31) || surface || char(31) || source = ?1;",
    ),
    write("jobs.delete", "jobs", "DELETE FROM jobs WHERE job_id = ?1;"),
    read(
        "app_log.recent",
        "app_log",
        "SELECT log_id, area, level, code, message, context_json, record_json, created_at_ms FROM app_log ORDER BY created_at_ms DESC, log_id ASC LIMIT ?1;",
    ),
    write(
        "app_log.insert",
        "app_log",
        "INSERT INTO app_log (log_id, area, level, code, message, context_json, record_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(log_id) DO UPDATE SET area = excluded.area, level = excluded.level, code = excluded.code, message = excluded.message, context_json = excluded.context_json, record_json = excluded.record_json, created_at_ms = excluded.created_at_ms;",
    ),
    write(
        "app_log.clear_before",
        "app_log",
        "DELETE FROM app_log WHERE created_at_ms <= ?1;",
    ),
];

const fn read(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Read)
}

const fn write(id: &'static str, table: &'static str, sql: &'static str) -> SqliteStatementSpec {
    statement(id, table, sql, Op::Write)
}

const fn statement(
    id: &'static str,
    table_name: &'static str,
    sql: &'static str,
    operation: Op,
) -> SqliteStatementSpec {
    SqliteStatementSpec {
        id,
        sql,
        table_name,
        operation,
    }
}
