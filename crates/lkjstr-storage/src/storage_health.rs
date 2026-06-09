#![doc = "SQLite storage health row for Stats."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteStorageHealth {
    pub mode: String,
    pub vfs_name: String,
    pub worker_kind: String,
    pub sqlite_version: String,
    pub database_name: String,
    pub applied_schema_changes: Vec<String>,
    pub page_count: u64,
    pub page_size: u64,
    pub freelist_count: u64,
    pub event_count: u64,
    pub relay_receipt_count: u64,
    pub tag_row_count: u64,
    pub last_integrity_check_at: Option<u64>,
    pub warnings: Vec<String>,
}
