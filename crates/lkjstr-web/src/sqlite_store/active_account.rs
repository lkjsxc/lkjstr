#![doc = "SQLite active-account selector repository calls."]

use lkjstr_storage::{
    ActiveAccountSelectorRecord, SqliteActiveAccountSelectorRow, StorageOperation, StorageOutcome,
    StorageProblem, StorageProblemKind, active_account_selector_from_sqlite_row,
    active_account_selector_key, sqlite_active_account_selector_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, params, text},
    rows::first_row,
};

pub async fn sqlite_active_account_selector_put(
    store: &SqliteStore,
    row: &ActiveAccountSelectorRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_active_account_selector_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("settings.upsert"),
    };
    store
        .execute(
            "settings.upsert",
            params(vec![
                text(row.key),
                text(row.value_json),
                integer(row.updated_at_ms),
            ]),
        )
        .await
}

pub async fn sqlite_active_account_selector_get(
    store: &SqliteStore,
) -> StorageOutcome<Option<ActiveAccountSelectorRecord>> {
    let rows = match store
        .query(
            "settings.select",
            params(vec![text(active_account_selector_key())]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteActiveAccountSelectorRow>(rows, "settings", "settings.select") {
        StorageOutcome::Ok(Some(row)) => match active_account_selector_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("settings.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_active_account_selector_delete(store: &SqliteStore) -> StorageOutcome<()> {
    store
        .execute(
            "settings.delete",
            params(vec![text(active_account_selector_key())]),
        )
        .await
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(StorageProblem::with_kind(
        StorageOperation::Read,
        "settings",
        StorageProblemKind::ActiveAccountSelectorDecodeFailed,
        operation_id,
    ))
}
