#![doc = "SQLite cache, diagnostics, ledger, and metadata table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    resource::CacheResourceKind as Resource,
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

macro_rules! recoverable {
    ($name:literal, $owner:literal, $resource:expr, $sql:literal) => {
        SqliteTableSpec {
            name: $name,
            create_sql: $sql,
            data_class: DataClass::RecoverableCache,
            inventory_group: Group::PrunableCache,
            primary_owner: $owner,
            retention: Retention::Recoverable,
            ledger_resource_kind: $resource,
        }
    };
}

macro_rules! derived {
    ($name:literal, $resource:expr, $sql:literal) => {
        SqliteTableSpec {
            name: $name,
            create_sql: $sql,
            data_class: DataClass::DerivedFeedCache,
            inventory_group: Group::DerivedPageCache,
            primary_owner: "feeds",
            retention: Retention::Recoverable,
            ledger_resource_kind: $resource,
        }
    };
}

pub const SQLITE_CACHE_TABLES: &[SqliteTableSpec] = &[
    recoverable!(
        "events",
        "events",
        Some(Resource::NostrEvent),
        r#"CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  kind INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  sig TEXT NOT NULL,
  content TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  received_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    recoverable!(
        "event_tags",
        "events",
        Some(Resource::NostrEvent),
        r#"CREATE TABLE IF NOT EXISTS event_tags (
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  tag_index INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  value_0 TEXT,
  value_1 TEXT,
  value_2 TEXT,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (event_id, tag_index)
) STRICT;"#
    ),
    recoverable!(
        "event_relays",
        "events",
        Some(Resource::NostrEvent),
        r#"CREATE TABLE IF NOT EXISTS event_relays (
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  relay_url TEXT NOT NULL,
  first_seen_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER NOT NULL,
  source_kind TEXT NOT NULL,
  PRIMARY KEY (event_id, relay_url)
) STRICT;"#
    ),
    recoverable!(
        "notifications",
        "notifications",
        Some(Resource::NotificationRecord),
        r#"CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  owner_pubkey TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  target_event_id TEXT,
  root_event_id TEXT,
  actor_pubkey TEXT NOT NULL,
  notification_kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    derived!(
        "feed_cursors",
        Some(Resource::FeedCursor),
        r#"CREATE TABLE IF NOT EXISTS feed_cursors (
  cursor_id TEXT PRIMARY KEY,
  feed_key TEXT NOT NULL,
  relay_set_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('older', 'newer')),
  cursor_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#
    ),
    derived!(
        "feed_coverage",
        Some(Resource::CoverageRow),
        r#"CREATE TABLE IF NOT EXISTS feed_coverage (
  coverage_id TEXT PRIMARY KEY,
  feed_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  filter_fingerprint TEXT NOT NULL,
  since_exclusive INTEGER,
  until_exclusive INTEGER,
  completed_at_ms INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  dense INTEGER NOT NULL CHECK (dense IN (0, 1))
) STRICT;"#
    ),
    derived!(
        "feed_scan_hints",
        Some(Resource::ScanHint),
        r#"CREATE TABLE IF NOT EXISTS feed_scan_hints (
  semantic_feed_key TEXT NOT NULL,
  route_group_key TEXT NOT NULL,
  relay_url TEXT NOT NULL,
  semantic_filter_key TEXT NOT NULL,
  direction TEXT NOT NULL,
  route_fingerprint TEXT NOT NULL,
  current_span_seconds INTEGER NOT NULL,
  next_span_seconds INTEGER NOT NULL,
  min_span_seconds INTEGER NOT NULL,
  max_span_seconds INTEGER NOT NULL,
  last_feedback TEXT NOT NULL,
  density_ewma REAL NOT NULL,
  complete_window_count INTEGER NOT NULL,
  dense_window_count INTEGER NOT NULL,
  incomplete_window_count INTEGER NOT NULL,
  last_since INTEGER NOT NULL,
  last_until INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY (semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint)
) STRICT;"#
    ),
    recoverable!(
        "jobs",
        "jobs",
        Some(Resource::JobRecord),
        r#"CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  job_kind TEXT NOT NULL,
  state TEXT NOT NULL,
  owner_id TEXT,
  payload_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER
) STRICT;"#
    ),
];
