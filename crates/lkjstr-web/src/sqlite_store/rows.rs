#![doc = "SQLite row decoding helpers."]

use serde::de::DeserializeOwned;

use crate::storage_worker::SqlRow;
use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

pub fn first_row<T: DeserializeOwned>(
    rows: Vec<SqlRow>,
    table: &'static str,
    operation_id: &'static str,
) -> StorageOutcome<Option<T>> {
    match rows.into_iter().next() {
        Some(row) => decode(row, table, operation_id).map(Some),
        None => StorageOutcome::Ok(None),
    }
}

pub fn all_rows<T: DeserializeOwned>(
    rows: Vec<SqlRow>,
    table: &'static str,
    operation_id: &'static str,
) -> StorageOutcome<Vec<T>> {
    let mut decoded = Vec::with_capacity(rows.len());
    for row in rows {
        match decode(row, table, operation_id) {
            StorageOutcome::Ok(row) => decoded.push(row),
            outcome => return outcome.map(|_| Vec::new()),
        }
    }
    StorageOutcome::Ok(decoded)
}

fn decode<T: DeserializeOwned>(
    row: SqlRow,
    table: &'static str,
    operation_id: &'static str,
) -> StorageOutcome<T> {
    match serde_json::to_value(row).and_then(serde_json::from_value) {
        Ok(row) => StorageOutcome::Ok(row),
        Err(_) => StorageOutcome::Corrupt(StorageProblem::new(
            StorageOperation::Read,
            table,
            "corrupt",
            operation_id,
        )),
    }
}
