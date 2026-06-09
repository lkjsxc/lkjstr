#![doc = "Stats inventory rows derived from manifests and counts."]

use std::collections::BTreeMap;

use crate::manifest::storage_table_specs;
use crate::sql::sqlite_schema_tables;
use crate::stats_rows::{StorageInventoryRow, StorageTableCount};

pub(super) fn manifest_rows(counts: Vec<StorageTableCount>) -> Vec<StorageInventoryRow> {
    let counts = counts_by_table(counts);
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

pub(super) fn sqlite_rows(counts: Vec<StorageTableCount>) -> Vec<StorageInventoryRow> {
    let counts = counts_by_table(counts);
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

pub(super) fn inventory_status(table_count: usize, available_table_count: usize) -> &'static str {
    if table_count == available_table_count {
        "complete"
    } else if available_table_count == 0 {
        "unavailable"
    } else {
        "partial"
    }
}

fn counts_by_table(counts: Vec<StorageTableCount>) -> BTreeMap<String, StorageTableCount> {
    counts
        .into_iter()
        .map(|count| (count.table.clone(), count))
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
