#![doc = "SQLite diagnostics table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    resource::CacheResourceKind as Resource,
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

macro_rules! diagnostic {
    ($name:literal, $owner:literal, $resource:expr, $sql:literal) => {
        SqliteTableSpec {
            name: $name,
            create_sql: $sql,
            data_class: DataClass::DiagnosticsCache,
            inventory_group: Group::Diagnostics,
            primary_owner: $owner,
            retention: Retention::Recoverable,
            ledger_resource_kind: $resource,
        }
    };
}

pub const SQLITE_DIAGNOSTIC_TABLES: &[SqliteTableSpec] = &[
    diagnostic!(
        "relay_information",
        "relays",
        Some(Resource::RelayInfo),
        r#"CREATE TABLE IF NOT EXISTS relay_information (
  relay_url TEXT PRIMARY KEY,
  info_json TEXT NOT NULL,
  fetched_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    diagnostic!(
        "relay_diagnostic_summaries",
        "relays",
        Some(Resource::RelaySummary),
        r#"CREATE TABLE IF NOT EXISTS relay_diagnostic_summaries (
  relay_url TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    diagnostic!(
        "relay_list_suggestions",
        "relays",
        Some(Resource::RelayListSuggestion),
        r#"CREATE TABLE IF NOT EXISTS relay_list_suggestions (
  pubkey TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (pubkey, relay_url, purpose)
) STRICT;"#
    ),
    diagnostic!(
        "author_relay_routes",
        "relays",
        Some(Resource::AuthorRelayRoute),
        r#"CREATE TABLE IF NOT EXISTS author_relay_routes (
  pubkey TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  route_kind TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER,
  PRIMARY KEY (pubkey, relay_url, route_kind)
) STRICT;"#
    ),
    diagnostic!(
        "app_log",
        "app",
        None,
        r#"CREATE TABLE IF NOT EXISTS app_log (
  log_id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
];
