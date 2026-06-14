#![doc = "SQLite index records."]

use crate::sql::SqliteIndexSpec;

pub const SQLITE_INDEXES: &[SqliteIndexSpec] = &[
    index(
        "tab_states_by_workspace_updated",
        "tab_states",
        "CREATE INDEX IF NOT EXISTS tab_states_by_workspace_updated ON tab_states (workspace_id, updated_at_ms DESC);",
    ),
    index(
        "events_by_kind_time",
        "events",
        "CREATE INDEX IF NOT EXISTS events_by_kind_time ON events (kind, created_at DESC, event_id);",
    ),
    index(
        "events_by_pubkey_kind_time",
        "events",
        "CREATE INDEX IF NOT EXISTS events_by_pubkey_kind_time ON events (pubkey, kind, created_at DESC, event_id);",
    ),
    index(
        "event_tags_lookup",
        "event_tags",
        "CREATE INDEX IF NOT EXISTS event_tags_lookup ON event_tags (tag_name, value_0, event_id);",
    ),
    index(
        "event_relays_by_relay",
        "event_relays",
        "CREATE INDEX IF NOT EXISTS event_relays_by_relay ON event_relays (relay_url, last_seen_at_ms DESC);",
    ),
    index(
        "event_search_tokens_lookup",
        "event_search_tokens",
        "CREATE INDEX IF NOT EXISTS event_search_tokens_lookup ON event_search_tokens (token, created_at DESC, event_id);",
    ),
    index(
        "event_search_tokens_event",
        "event_search_tokens",
        "CREATE INDEX IF NOT EXISTS event_search_tokens_event ON event_search_tokens (event_id);",
    ),
    index(
        "notifications_by_owner_time",
        "notifications",
        "CREATE INDEX IF NOT EXISTS notifications_by_owner_time ON notifications (owner_pubkey, created_at DESC, notification_id);",
    ),
    index(
        "feed_coverage_lookup",
        "feed_coverage",
        "CREATE INDEX IF NOT EXISTS feed_coverage_lookup ON feed_coverage (feed_key, route_group_key, relay_url, filter_fingerprint, status, since_exclusive, until_exclusive);",
    ),
    index(
        "feed_scan_hints_lookup",
        "feed_scan_hints",
        "CREATE INDEX IF NOT EXISTS feed_scan_hints_lookup ON feed_scan_hints (semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, expires_at_ms);",
    ),
    index(
        "feed_scan_observations_recent",
        "feed_scan_observations",
        "CREATE INDEX IF NOT EXISTS feed_scan_observations_recent ON feed_scan_observations (created_at_ms DESC, relay_url);",
    ),
    index(
        "feed_scan_density_models_context",
        "feed_scan_density_models",
        "CREATE INDEX IF NOT EXISTS feed_scan_density_models_context ON feed_scan_density_models (direction, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, updated_at_ms DESC);",
    ),
    index(
        "feed_row_height_observations_recent",
        "feed_row_height_observations",
        "CREATE INDEX IF NOT EXISTS feed_row_height_observations_recent ON feed_row_height_observations (observed_at_ms DESC, bucket_key);",
    ),
    index(
        "relay_read_observations_recent",
        "relay_read_observations",
        "CREATE INDEX IF NOT EXISTS relay_read_observations_recent ON relay_read_observations (created_at_ms DESC, relay_url);",
    ),
    index(
        "relay_read_scores_recent",
        "relay_read_scores",
        "CREATE INDEX IF NOT EXISTS relay_read_scores_recent ON relay_read_scores (relay_url, surface, updated_at_ms DESC);",
    ),
    index(
        "route_evidence_scores_author",
        "route_evidence_scores",
        "CREATE INDEX IF NOT EXISTS route_evidence_scores_author ON route_evidence_scores (author_pubkey, surface, updated_at_ms DESC);",
    ),
    index(
        "jobs_by_state_updated",
        "jobs",
        "CREATE INDEX IF NOT EXISTS jobs_by_state_updated ON jobs (state, updated_at_ms DESC);",
    ),
    index(
        "cache_ledger_prune",
        "cache_ledger",
        "CREATE INDEX IF NOT EXISTS cache_ledger_prune ON cache_ledger (protected, score, updated_at_ms);",
    ),
    index(
        "app_log_by_time",
        "app_log",
        "CREATE INDEX IF NOT EXISTS app_log_by_time ON app_log (created_at_ms DESC, log_id);",
    ),
];

const fn index(
    name: &'static str,
    table_name: &'static str,
    create_sql: &'static str,
) -> SqliteIndexSpec {
    SqliteIndexSpec {
        name,
        table_name,
        create_sql,
    }
}
