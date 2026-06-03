#![doc = "SQLite optimizer repository statement records."]

use crate::{StorageOperation as Op, sql::SqliteStatementSpec};

pub const OPTIMIZER_STATEMENTS: &[SqliteStatementSpec] = &[
    write(
        "feed_scan_observations.insert",
        "feed_scan_observations",
        "INSERT INTO feed_scan_observations (id, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, since_seconds, until_seconds, requested_limit, effective_limit, event_count, unique_event_count, final_visible_count, event_limit_reached, eose, timeout, closed, auth, socket_error, bytes_sent, bytes_received, started_at_ms, completed_at_ms, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25);",
    ),
    read(
        "feed_scan_density_models.select_context",
        "feed_scan_density_models",
        "SELECT model_key, scope, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, target_limit_fraction, density_events_per_second, log_density_mean, log_density_variance, sample_weight, complete_window_count, dense_window_count, sparse_window_count, incomplete_window_count, failure_window_count, limit_hit_rate, incomplete_rate, last_good_span_seconds, last_proposed_span_seconds, last_observed_since_seconds, last_observed_until_seconds, updated_at_ms, decays_after_ms FROM feed_scan_density_models WHERE direction = ?1 AND (semantic_feed_key = ?2 OR semantic_feed_key = '') ORDER BY updated_at_ms DESC, model_key ASC;",
    ),
    write(
        "feed_scan_density_models.upsert",
        "feed_scan_density_models",
        "INSERT INTO feed_scan_density_models (model_key, scope, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, target_limit_fraction, density_events_per_second, log_density_mean, log_density_variance, sample_weight, complete_window_count, dense_window_count, sparse_window_count, incomplete_window_count, failure_window_count, limit_hit_rate, incomplete_rate, last_good_span_seconds, last_proposed_span_seconds, last_observed_since_seconds, last_observed_until_seconds, updated_at_ms, decays_after_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26) ON CONFLICT(model_key) DO UPDATE SET density_events_per_second = excluded.density_events_per_second, log_density_mean = excluded.log_density_mean, log_density_variance = excluded.log_density_variance, sample_weight = excluded.sample_weight, complete_window_count = excluded.complete_window_count, dense_window_count = excluded.dense_window_count, sparse_window_count = excluded.sparse_window_count, incomplete_window_count = excluded.incomplete_window_count, failure_window_count = excluded.failure_window_count, limit_hit_rate = excluded.limit_hit_rate, incomplete_rate = excluded.incomplete_rate, last_good_span_seconds = excluded.last_good_span_seconds, last_proposed_span_seconds = excluded.last_proposed_span_seconds, last_observed_since_seconds = excluded.last_observed_since_seconds, last_observed_until_seconds = excluded.last_observed_until_seconds, updated_at_ms = excluded.updated_at_ms, decays_after_ms = excluded.decays_after_ms;",
    ),
    write(
        "feed_scan_decision_traces.insert",
        "feed_scan_decision_traces",
        "INSERT INTO feed_scan_decision_traces (trace_id, model_key, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, source_scope, confidence, target_count, effective_limit, density_events_per_second, previous_span_seconds, proposed_span_seconds, cap_reason, diagnostics_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18);",
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
