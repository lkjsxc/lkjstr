#![doc = "SQLite settings repository calls."]

use lkjstr_storage::{
    SettingOverrideRecord, SqliteSettingRow, StorageOutcome, setting_from_sqlite_row,
    sqlite_setting_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, no_params, params, text},
    rows::{all_rows, first_row},
};

pub async fn sqlite_setting_put(
    store: &SqliteStore,
    row: &SettingOverrideRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_setting_row(row) {
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

pub async fn sqlite_setting_delete(store: &SqliteStore, key: &str) -> StorageOutcome<()> {
    store
        .execute("settings.delete", params(vec![text(key)]))
        .await
}

pub async fn sqlite_setting_get(
    store: &SqliteStore,
    key: &str,
) -> StorageOutcome<Option<SettingOverrideRecord>> {
    let rows = match store
        .query("settings.select", params(vec![text(key)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteSettingRow>(rows, "settings", "settings.select") {
        StorageOutcome::Ok(Some(row)) => match setting_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("settings.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_settings_all(
    store: &SqliteStore,
) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    let rows = match store.query("settings.all", no_params(), 1_000).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows = match all_rows::<SqliteSettingRow>(rows, "settings", "settings.all") {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let mut out = Vec::with_capacity(sqlite_rows.len());
    for row in sqlite_rows {
        match setting_from_sqlite_row(&row) {
            Ok(row) => out.push(row),
            Err(_) => return corrupt("settings.all"),
        }
    }
    StorageOutcome::Ok(out)
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "settings",
        "corrupt",
        operation_id,
    ))
}
