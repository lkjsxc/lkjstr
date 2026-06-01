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
        "notifications_by_owner_time",
        "notifications",
        "CREATE INDEX IF NOT EXISTS notifications_by_owner_time ON notifications (owner_pubkey, created_at DESC, notification_id);",
    ),
    index(
        "feed_coverage_lookup",
        "feed_coverage",
        "CREATE INDEX IF NOT EXISTS feed_coverage_lookup ON feed_coverage (feed_key, relay_url, filter_fingerprint, since_exclusive, until_exclusive);",
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
