#![doc = "SQLite app log repository calls."]

use lkjstr_storage::{AppLogRecord, SqliteAppLogRow, StorageOutcome};

use crate::sqlite_store::{
    database::SqliteStore,
    diagnostic_params::app_log_params,
    params::{integer, params},
    rows::all_rows,
};

pub async fn sqlite_app_log_insert(store: &SqliteStore, row: &AppLogRecord) -> StorageOutcome<()> {
    store
        .execute("app_log.insert", app_log_params(row.clone()))
        .await
}

pub async fn sqlite_app_log_recent(
    store: &SqliteStore,
    limit: u64,
) -> StorageOutcome<Vec<AppLogRecord>> {
    let rows = match store
        .query("app_log.recent", params(vec![integer(limit)]), limit as u32)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteAppLogRow>(rows, "app_log", "app_log.recent")
}

pub async fn sqlite_app_log_clear_before(
    store: &SqliteStore,
    before_ms: u64,
) -> StorageOutcome<()> {
    store
        .execute("app_log.clear_before", params(vec![integer(before_ms)]))
        .await
}
