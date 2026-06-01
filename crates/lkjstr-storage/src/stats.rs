#![doc = "Storage inventory view models for Stats."]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::manifest::storage_table_specs;
use crate::sql::sqlite_schema_tables;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageTableCount {
    pub table: String,
    pub row_count: Option<u64>,
    pub problem_reason: Option<String>,
}

impl StorageTableCount {
    #[must_use]
    pub fn available(table: impl Into<String>, row_count: u64) -> Self {
        Self {
            table: table.into(),
            row_count: Some(row_count),
            problem_reason: None,
        }
    }

    #[must_use]
    pub fn unavailable(table: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            table: table.into(),
            row_count: None,
            problem_reason: Some(reason.into()),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageInventoryRow {
    pub table: String,
    pub data_class: String,
    pub group: String,
    pub status: String,
    pub row_count: Option<u64>,
    pub problem_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteRowCount {
    pub row_count: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageStatsSnapshot {
    pub inventory_status: String,
    pub table_count: usize,
    pub available_table_count: usize,
    pub unavailable_table_count: usize,
    pub total_known_rows: u64,
    pub rows: Vec<StorageInventoryRow>,
}

impl StorageStatsSnapshot {
    #[must_use]
    pub fn from_counts(counts: Vec<StorageTableCount>) -> Self {
        let counts_by_table = counts
            .into_iter()
            .map(|count| (count.table.clone(), count))
            .collect::<BTreeMap<_, _>>();
        let rows = storage_table_specs()
            .iter()
            .map(|spec| {
                let count = counts_by_table.get(spec.name);
                let row_count = count.and_then(|item| item.row_count);
                let problem_reason = count.and_then(|item| item.problem_reason.clone());
                StorageInventoryRow {
                    table: spec.name.to_string(),
                    data_class: spec.data_class.as_str().to_string(),
                    group: spec.inventory_group.as_str().to_string(),
                    status: row_status(row_count, problem_reason.as_deref()).to_string(),
                    row_count,
                    problem_reason,
                }
            })
            .collect::<Vec<_>>();
        Self::from_rows(rows)
    }

    #[must_use]
    pub fn manifest_unavailable(reason: &str) -> Self {
        let counts = storage_table_specs()
            .iter()
            .map(|spec| StorageTableCount::unavailable(spec.name, reason))
            .collect();
        Self::from_counts(counts)
    }

    #[must_use]
    pub fn from_sqlite_counts(counts: Vec<StorageTableCount>) -> Self {
        let counts_by_table = counts
            .into_iter()
            .map(|count| (count.table.clone(), count))
            .collect::<BTreeMap<_, _>>();
        let rows = sqlite_schema_tables()
            .into_iter()
            .map(|spec| {
                let count = counts_by_table.get(spec.name);
                let row_count = count.and_then(|item| item.row_count);
                let problem_reason = count.and_then(|item| item.problem_reason.clone());
                StorageInventoryRow {
                    table: spec.name.to_string(),
                    data_class: spec.data_class.as_str().to_string(),
                    group: spec.inventory_group.as_str().to_string(),
                    status: row_status(row_count, problem_reason.as_deref()).to_string(),
                    row_count,
                    problem_reason,
                }
            })
            .collect::<Vec<_>>();
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
            rows,
        }
    }
}

fn row_status(row_count: Option<u64>, reason: Option<&str>) -> &'static str {
    if row_count.is_some() {
        return "available";
    }
    if reason.is_some() {
        return "unavailable";
    }
    "unavailable"
}

fn inventory_status(table_count: usize, available_table_count: usize) -> &'static str {
    if table_count == available_table_count {
        return "complete";
    }
    if available_table_count == 0 {
        return "unavailable";
    }
    "partial"
}
