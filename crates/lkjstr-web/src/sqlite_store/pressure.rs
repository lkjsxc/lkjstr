#![doc = "SQLite storage pressure snapshot repository calls."]

use lkjstr_storage::{
    SqliteStoragePressureSnapshotRow, StorageOperation, StorageOutcome,
    StoragePressureSnapshotRecord, StorageProblem, StorageProblemKind,
    sqlite_storage_pressure_snapshot_row, storage_pressure_from_sqlite_row,
    storage_pressure_meta_key,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, params, text},
    rows::first_row,
};

pub async fn sqlite_storage_pressure_put(
    store: &SqliteStore,
    row: &StoragePressureSnapshotRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_storage_pressure_snapshot_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt(StorageOperation::Write, "cache_meta.upsert"),
    };
    store
        .execute(
            "cache_meta.upsert",
            params(vec![
                text(row.key),
                text(row.value_json),
                integer(row.updated_at_ms),
            ]),
        )
        .await
}

pub async fn sqlite_storage_pressure_get(
    store: &SqliteStore,
) -> StorageOutcome<Option<StoragePressureSnapshotRecord>> {
    let rows = match store
        .query(
            "cache_meta.select",
            params(vec![text(storage_pressure_meta_key())]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteStoragePressureSnapshotRow>(rows, "cache_meta", "cache_meta.select") {
        StorageOutcome::Ok(Some(row)) => match storage_pressure_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt(StorageOperation::Read, "cache_meta.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

fn corrupt<T>(operation: StorageOperation, operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(StorageProblem::with_kind(
        operation,
        "cache_meta",
        StorageProblemKind::PressureSnapshotDecodeFailed,
        operation_id,
    ))
}
