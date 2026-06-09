#![doc = "Storage inventory view models for Stats."]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub use crate::stats_rows::{SqliteRowCount, StorageInventoryRow, StorageTableCount};

use crate::manifest::storage_table_specs;
use crate::pressure::StoragePressureSnapshotRecord;
use crate::sql::sqlite_schema_tables;
use crate::storage_health::SqliteStorageHealth;

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
    pub rows: Vec<StorageInventoryRow>,
}

impl StorageStatsSnapshot {
    #[must_use]
    pub fn from_counts(counts: Vec<StorageTableCount>) -> Self {
        let rows = manifest_rows(counts_by_table(counts));
        Self::from_rows(rows)
    }

    #[must_use]
    pub fn manifest_unavailable(reason: &str) -> Self {
        let counts = storage_table_specs()
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
        let rows = sqlite_rows(counts_by_table(counts));
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
        self.storage_pressure = Some(pressure);
        self
    }

    #[must_use]
    pub fn with_storage_pressure_problem(mut self, reason: &str) -> Self {
        self.storage_pressure_status = reason.to_string();
        self.storage_pressure_reason = Some(reason.to_string());
        self.storage_pressure = None;
        self
    }
}

fn counts_by_table(counts: Vec<StorageTableCount>) -> BTreeMap<String, StorageTableCount> {
    counts
        .into_iter()
        .map(|count| (count.table.clone(), count))
        .collect()
}

fn manifest_rows(counts: BTreeMap<String, StorageTableCount>) -> Vec<StorageInventoryRow> {
    storage_table_specs()
        .iter()
        .map(|spec| {
            inventory_row(
                spec.name,
                spec.data_class.as_str(),
                spec.inventory_group.as_str(),
                &counts,
            )
        })
        .collect()
}

fn sqlite_rows(counts: BTreeMap<String, StorageTableCount>) -> Vec<StorageInventoryRow> {
    sqlite_schema_tables()
        .into_iter()
        .map(|spec| {
            inventory_row(
                spec.name,
                spec.data_class.as_str(),
                spec.inventory_group.as_str(),
                &counts,
            )
        })
        .collect()
}

fn inventory_row(
    table: &str,
    data_class: &str,
    group: &str,
    counts: &BTreeMap<String, StorageTableCount>,
) -> StorageInventoryRow {
    let count = counts.get(table);
    let row_count = count.and_then(|item| item.row_count);
    let problem_reason = count.and_then(|item| item.problem_reason.clone());
    StorageInventoryRow {
        table: table.to_string(),
        data_class: data_class.to_string(),
        group: group.to_string(),
        status: row_status(row_count).to_string(),
        row_count,
        problem_reason,
    }
}

fn row_status(row_count: Option<u64>) -> &'static str {
    if row_count.is_some() {
        "available"
    } else {
        "unavailable"
    }
}

fn inventory_status(table_count: usize, available_table_count: usize) -> &'static str {
    if table_count == available_table_count {
        "complete"
    } else if available_table_count == 0 {
        "unavailable"
    } else {
        "partial"
    }
}

fn storage_health_status(health: &SqliteStorageHealth) -> &'static str {
    if health.mode == "temporary-memory" {
        "temporary-memory"
    } else {
        "available"
    }
}
