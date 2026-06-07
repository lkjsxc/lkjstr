#![doc = "SQLite storage inventory calls for Stats."]

use lkjstr_storage::{
    SqliteRowCount, StorageOperation, StorageOutcome, StorageStatsSnapshot, StorageTableCount,
    sqlite_schema_table_names, sqlite_table_count_sql,
};

use crate::sqlite_store::{SqliteStore, rows::first_row};

pub async fn sqlite_storage_stats_snapshot(store: &SqliteStore) -> StorageStatsSnapshot {
    let health = store.storage_health().await;
    let mut counts = Vec::new();
    for table in sqlite_schema_table_names() {
        counts.push(sqlite_table_count(store, table).await);
    }
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(counts);
    match health {
        StorageOutcome::Ok(health) => snapshot.with_storage_health(health),
        outcome => snapshot.with_storage_health_problem(&outcome_reason(outcome)),
    }
}

async fn sqlite_table_count(store: &SqliteStore, table: &'static str) -> StorageTableCount {
    match count_table(store, table).await {
        StorageOutcome::Ok(count) => StorageTableCount::available(table, count),
        outcome => StorageTableCount::unavailable(table, outcome_reason(outcome)),
    }
}

async fn count_table(store: &SqliteStore, table: &'static str) -> StorageOutcome<u64> {
    let Some(sql) = sqlite_table_count_sql(table) else {
        return StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
            StorageOperation::Inventory,
            table,
            "missing-count-statement",
            "sqlite_table_count",
        ));
    };
    let rows = match store.query_sql(sql, None, 1).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| 0),
    };
    match first_row::<SqliteRowCount>(rows, table, "sqlite_table_count") {
        StorageOutcome::Ok(Some(row)) => StorageOutcome::Ok(row.row_count),
        StorageOutcome::Ok(None) => StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
            StorageOperation::Inventory,
            table,
            "missing-count-row",
            "sqlite_table_count",
        )),
        outcome => outcome.map(|_| 0),
    }
}

fn outcome_reason<T>(outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || "unavailable".to_string(),
        |problem| problem.reason.to_string(),
    )
}
