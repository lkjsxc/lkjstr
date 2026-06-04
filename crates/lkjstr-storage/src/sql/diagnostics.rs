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
        "relay_read_observations",
        "relays",
        Some(Resource::RelayReadObservation),
        r#"CREATE TABLE IF NOT EXISTS relay_read_observations (
  id TEXT PRIMARY KEY,
  relay_url TEXT NOT NULL,
  surface TEXT NOT NULL,
  phase TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  semantic_feed_key TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  purpose TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  first_event_ms INTEGER,
  eose_ms INTEGER,
  duration_ms INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  unique_event_count INTEGER NOT NULL,
  final_count INTEGER NOT NULL,
  timeout INTEGER NOT NULL CHECK (timeout IN (0, 1)),
  closed INTEGER NOT NULL CHECK (closed IN (0, 1)),
  auth INTEGER NOT NULL CHECK (auth IN (0, 1)),
  socket_error INTEGER NOT NULL CHECK (socket_error IN (0, 1)),
  event_limit_reached INTEGER NOT NULL CHECK (event_limit_reached IN (0, 1)),
  bytes_sent INTEGER NOT NULL,
  bytes_received INTEGER NOT NULL,
  route_evidence_sources_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    diagnostic!(
        "relay_read_scores",
        "relays",
        Some(Resource::RelayReadScore),
        r#"CREATE TABLE IF NOT EXISTS relay_read_scores (
  relay_url TEXT NOT NULL,
  surface TEXT NOT NULL,
  phase TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  filter_shape TEXT NOT NULL,
  purpose TEXT NOT NULL,
  reliability REAL NOT NULL,
  first_event_speed REAL NOT NULL,
  eose_speed REAL NOT NULL,
  useful_yield REAL NOT NULL,
  unique_yield REAL NOT NULL,
  penalty REAL NOT NULL,
  fairness_credit REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (relay_url, surface, phase, direction, route_group_key, filter_shape, purpose)
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
        "route_evidence_scores",
        "relays",
        Some(Resource::RouteEvidenceScore),
        r#"CREATE TABLE IF NOT EXISTS route_evidence_scores (
  author_pubkey TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  surface TEXT NOT NULL,
  source TEXT NOT NULL,
  source_confidence REAL NOT NULL,
  measured_success INTEGER NOT NULL,
  measured_failure INTEGER NOT NULL,
  last_success_at_ms INTEGER,
  last_failure_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (author_pubkey, relay_url, surface, source)
) STRICT;"#
    ),
    diagnostic!(
        "app_log",
        "app",
        None,
        r#"CREATE TABLE IF NOT EXISTS app_log (
  log_id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  level TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
];
