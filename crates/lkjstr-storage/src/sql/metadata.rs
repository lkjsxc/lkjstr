#![doc = "SQLite ledger and metadata table records."]

use crate::{
    data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group},
    sql::{SqliteRetentionClass as Retention, SqliteTableSpec},
};

pub const SQLITE_METADATA_TABLES: &[SqliteTableSpec] = &[
    SqliteTableSpec {
        name: "cache_ledger",
        create_sql: r#"CREATE TABLE IF NOT EXISTS cache_ledger (
  resource_id TEXT PRIMARY KEY,
  resource_kind TEXT NOT NULL,
  table_name TEXT NOT NULL,
  byte_count INTEGER NOT NULL,
  protected INTEGER NOT NULL CHECK (protected IN (0, 1)),
  score INTEGER NOT NULL,
  owner_key TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#,
        data_class: DataClass::Ledger,
        inventory_group: Group::Ledger,
        primary_owner: "storage",
        retention: Retention::Ledger,
        ledger_resource_kind: None,
    },
    SqliteTableSpec {
        name: "cache_meta",
        create_sql: r#"CREATE TABLE IF NOT EXISTS cache_meta (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;"#,
        data_class: DataClass::Metadata,
        inventory_group: Group::Metadata,
        primary_owner: "storage",
        retention: Retention::Metadata,
        ledger_resource_kind: None,
    },
];
