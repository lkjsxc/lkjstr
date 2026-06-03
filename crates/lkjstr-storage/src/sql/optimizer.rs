#![doc = "SQLite optimizer table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    resource::CacheResourceKind as Resource,
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

macro_rules! optimizer {
    ($name:literal, $resource:expr, $sql:literal) => {
        SqliteTableSpec {
            name: $name,
            create_sql: $sql,
            data_class: DataClass::DiagnosticsCache,
            inventory_group: Group::Diagnostics,
            primary_owner: "optimizer",
            retention: Retention::Recoverable,
            ledger_resource_kind: $resource,
        }
    };
}

pub const SQLITE_OPTIMIZER_TABLES: &[SqliteTableSpec] = &[
    optimizer!(
        "feed_scan_observations",
        Some(Resource::ScanObservation),
        r#"CREATE TABLE IF NOT EXISTS feed_scan_observations (
  id TEXT PRIMARY KEY,
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  since_seconds INTEGER NOT NULL,
  until_seconds INTEGER NOT NULL,
  requested_limit INTEGER NOT NULL,
  effective_limit INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  unique_event_count INTEGER NOT NULL,
  final_visible_count INTEGER NOT NULL,
  event_limit_reached INTEGER NOT NULL CHECK (event_limit_reached IN (0, 1)),
  eose INTEGER NOT NULL CHECK (eose IN (0, 1)),
  timeout INTEGER NOT NULL CHECK (timeout IN (0, 1)),
  closed INTEGER NOT NULL CHECK (closed IN (0, 1)),
  auth INTEGER NOT NULL CHECK (auth IN (0, 1)),
  socket_error INTEGER NOT NULL CHECK (socket_error IN (0, 1)),
  bytes_sent INTEGER NOT NULL,
  bytes_received INTEGER NOT NULL,
  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    optimizer!(
        "feed_scan_density_models",
        Some(Resource::ScanDensityModel),
        r#"CREATE TABLE IF NOT EXISTS feed_scan_density_models (
  model_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  target_limit_fraction TEXT NOT NULL,
  density_events_per_second REAL NOT NULL,
  log_density_mean REAL NOT NULL,
  log_density_variance REAL NOT NULL,
  sample_weight REAL NOT NULL,
  complete_window_count INTEGER NOT NULL,
  dense_window_count INTEGER NOT NULL,
  sparse_window_count INTEGER NOT NULL,
  incomplete_window_count INTEGER NOT NULL,
  failure_window_count INTEGER NOT NULL,
  limit_hit_rate REAL NOT NULL,
  incomplete_rate REAL NOT NULL,
  last_good_span_seconds INTEGER NOT NULL,
  last_proposed_span_seconds INTEGER NOT NULL,
  last_observed_since_seconds INTEGER NOT NULL,
  last_observed_until_seconds INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  decays_after_ms INTEGER NOT NULL
) STRICT;"#
    ),
    optimizer!(
        "feed_scan_decision_traces",
        Some(Resource::ScanDecisionTrace),
        r#"CREATE TABLE IF NOT EXISTS feed_scan_decision_traces (
  trace_id TEXT PRIMARY KEY,
  model_key TEXT NOT NULL,
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  confidence REAL NOT NULL,
  target_count INTEGER NOT NULL,
  effective_limit INTEGER NOT NULL,
  density_events_per_second REAL NOT NULL,
  previous_span_seconds INTEGER NOT NULL,
  proposed_span_seconds INTEGER NOT NULL,
  cap_reason TEXT,
  diagnostics_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
];
