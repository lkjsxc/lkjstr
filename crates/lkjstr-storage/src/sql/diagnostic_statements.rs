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
    read(
        "app_log.recent",
        "app_log",
        "SELECT log_id, level, message, context_json, created_at_ms FROM app_log ORDER BY created_at_ms DESC, log_id ASC LIMIT ?1;",
    ),
    write(
        "app_log.insert",
        "app_log",
        "INSERT INTO app_log (log_id, level, message, context_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(log_id) DO UPDATE SET level = excluded.level, message = excluded.message, context_json = excluded.context_json, created_at_ms = excluded.created_at_ms;",
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
