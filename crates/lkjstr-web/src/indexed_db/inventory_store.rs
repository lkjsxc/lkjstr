use lkjstr_storage::{
    StorageOperation, StorageOutcome, StorageStatsSnapshot, StorageTableCount, storage_table_specs,
};
use wasm_bindgen::prelude::JsValue;
use web_sys::IdbTransactionMode;

use crate::indexed_db::{callbacks, database};

pub async fn storage_stats_snapshot(db_name: &str) -> StorageStatsSnapshot {
    let mut counts = Vec::new();
    for spec in storage_table_specs() {
        counts.push(table_count(db_name, spec.name).await);
    }
    StorageStatsSnapshot::from_counts(counts)
}

async fn table_count(db_name: &str, table: &'static str) -> StorageTableCount {
    match count_table(db_name, table).await {
        StorageOutcome::Ok(count) => StorageTableCount::available(table, count),
        outcome => StorageTableCount::unavailable(table, outcome_reason(outcome)),
    }
}

async fn count_table(db_name: &str, table: &'static str) -> StorageOutcome<u64> {
    let db = match database::open_database(
        db_name,
        StorageOperation::Inventory,
        table,
        format!("{table}:count"),
    )
    .await
    {
        StorageOutcome::Ok(db) => db,
        outcome => return outcome.map(|_db| 0),
    };
    let store = match database::object_store(&db, table, IdbTransactionMode::Readonly) {
        Ok(store) => store,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Inventory,
                table,
                format!("{table}:count"),
                error,
            );
        }
    };
    let request = match store.count() {
        Ok(request) => request,
        Err(error) => {
            return database::map_js_error(
                StorageOperation::Inventory,
                table,
                format!("{table}:count"),
                error,
            );
        }
    };
    let outcome = match callbacks::request_value(request).await {
        Ok(value) => count_from_value(table, value),
        Err(error) => database::map_js_error(
            StorageOperation::Inventory,
            table,
            format!("{table}:count"),
            error,
        ),
    };
    db.close();
    outcome
}

fn count_from_value(table: &'static str, value: JsValue) -> StorageOutcome<u64> {
    let Some(count) = value.as_f64() else {
        return database::corrupt(StorageOperation::Inventory, table, format!("{table}:count"));
    };
    if count.is_finite() && count >= 0.0 {
        return StorageOutcome::Ok(count as u64);
    }
    database::corrupt(StorageOperation::Inventory, table, format!("{table}:count"))
}

fn outcome_reason<T>(outcome: StorageOutcome<T>) -> String {
    outcome
        .problem()
        .map(|problem| problem.reason.to_string())
        .unwrap_or_else(|| "unavailable".to_string())
}
