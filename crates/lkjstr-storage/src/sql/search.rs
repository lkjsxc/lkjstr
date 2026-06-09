#![doc = "SQLite Search table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    resource::CacheResourceKind as Resource,
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

pub const SQLITE_SEARCH_TABLES: &[SqliteTableSpec] = &[SqliteTableSpec {
    name: "event_search_tokens",
    create_sql: r#"CREATE TABLE IF NOT EXISTS event_search_tokens (
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  pubkey TEXT NOT NULL,
  PRIMARY KEY (event_id, position)
) STRICT;"#,
    data_class: DataClass::RecoverableCache,
    inventory_group: Group::PrunableCache,
    primary_owner: "search",
    retention: Retention::Recoverable,
    ledger_resource_kind: Some(Resource::NostrEvent),
}];
