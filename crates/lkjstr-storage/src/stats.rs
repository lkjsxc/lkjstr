#![doc = "Storage inventory view models for Stats."]

use serde::{Deserialize, Serialize};

mod bytes;
mod inventory;

pub use crate::stats_rows::{SqliteRowCount, StorageInventoryRow, StorageTableCount};
pub use bytes::StorageByteInventoryRow;

use crate::pressure::StoragePressureSnapshotRecord;
use crate::storage_health::SqliteStorageHealth;
use bytes::pressure_byte_rows;
use inventory::{inventory_status, manifest_rows, sqlite_rows};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageStatsSnapshot {
    pub inventory_status: String,
    pub table_count: usize,
    pub available_table_count: usize,
    pub unavailable_table_count: usize,
    pub total_known_rows: u64,
    pub storage_health_status: String,
    pub storage_health_reason: Option<String>,
    pub storage_health: Option<SqliteStorageHealth>,
    pub storage_pressure_status: String,
    pub storage_pressure_reason: Option<String>,
    pub storage_pressure: Option<StoragePressureSnapshotRecord>,
    pub byte_rows: Vec<StorageByteInventoryRow>,
    pub rows: Vec<StorageInventoryRow>,
}

impl StorageStatsSnapshot {
    #[must_use]
    pub fn from_counts(counts: Vec<StorageTableCount>) -> Self {
        let rows = manifest_rows(counts);
        Self::from_rows(rows)
    }

    #[must_use]
    pub fn manifest_unavailable(reason: &str) -> Self {
        let counts = crate::storage_table_specs()
            .iter()
            .map(|spec| StorageTableCount::unavailable(spec.name, reason))
            .collect();
        Self::from_counts(counts)
            .with_storage_health_problem(reason)
            .with_storage_pressure_problem(reason)
    }

    #[must_use]
    pub fn timeout() -> Self {
        Self::manifest_unavailable("timeout")
    }

    #[must_use]
    pub fn from_sqlite_counts(counts: Vec<StorageTableCount>) -> Self {
        let rows = sqlite_rows(counts);
        Self::from_rows(rows)
    }

    #[must_use]
    pub fn from_rows(rows: Vec<StorageInventoryRow>) -> Self {
        let table_count = rows.len();
        let available_table_count = rows.iter().filter(|row| row.status == "available").count();
        let total_known_rows = rows.iter().filter_map(|row| row.row_count).sum();
        let unavailable_table_count = table_count.saturating_sub(available_table_count);
        Self {
            inventory_status: inventory_status(table_count, available_table_count).to_string(),
            table_count,
            available_table_count,
            unavailable_table_count,
            total_known_rows,
            storage_health_status: "unavailable".to_string(),
            storage_health_reason: Some("not-requested".to_string()),
            storage_health: None,
            storage_pressure_status: "unavailable".to_string(),
            storage_pressure_reason: Some("not-requested".to_string()),
            storage_pressure: None,
            byte_rows: pressure_byte_rows(None, Some("not-requested")),
            rows,
        }
    }

    #[must_use]
    pub fn with_storage_health(mut self, health: SqliteStorageHealth) -> Self {
        self.storage_health_status = storage_health_status(&health).to_string();
        self.storage_health_reason = None;
        self.storage_health = Some(health);
        self
    }

    #[must_use]
    pub fn with_storage_health_problem(mut self, reason: &str) -> Self {
        self.storage_health_status = reason.to_string();
        self.storage_health_reason = Some(reason.to_string());
        self.storage_health = None;
        self
    }

    #[must_use]
    pub fn with_storage_pressure(mut self, pressure: StoragePressureSnapshotRecord) -> Self {
        self.storage_pressure_status = pressure.stop_reason.clone();
        self.storage_pressure_reason = None;
        self.byte_rows = pressure_byte_rows(Some(&pressure), None);
        self.storage_pressure = Some(pressure);
        self
    }

    #[must_use]
    pub fn with_storage_pressure_problem(mut self, reason: &str) -> Self {
        self.storage_pressure_status = reason.to_string();
        self.storage_pressure_reason = Some(reason.to_string());
        self.storage_pressure = None;
        self.byte_rows = pressure_byte_rows(None, Some(reason));
        self
    }
}

fn storage_health_status(health: &SqliteStorageHealth) -> &'static str {
    if health.mode == "temporary-memory" {
        "temporary-memory"
    } else {
        "available"
    }
}
