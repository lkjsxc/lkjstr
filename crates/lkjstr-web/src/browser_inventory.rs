#![doc = "Browser-owned storage inventory rows for Rust Stats."]

use js_sys::{Array, Function, Promise, Reflect};
use lkjstr_storage::StorageInventoryRow;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

pub async fn browser_inventory_rows() -> Vec<StorageInventoryRow> {
    let mut rows = vec![local_storage_row()];
    rows.extend(old_indexed_db_rows().await);
    rows
}

fn local_storage_row() -> StorageInventoryRow {
    match local_storage_count() {
        Ok(count) => StorageInventoryRow {
            table: "localStorage".to_string(),
            data_class: "non-indexed-browser-storage".to_string(),
            group: "non-indexed".to_string(),
            status: "available".to_string(),
            row_count: Some(count),
            problem_reason: None,
        },
        Err(reason) => StorageInventoryRow {
            table: "localStorage".to_string(),
            data_class: "non-indexed-browser-storage".to_string(),
            group: "non-indexed".to_string(),
            status: "unavailable".to_string(),
            row_count: None,
            problem_reason: Some(reason.to_string()),
        },
    }
}

fn local_storage_count() -> Result<u64, &'static str> {
    let Some(window) = web_sys::window() else {
        return Err("missing-window");
    };
    let storage = window
        .local_storage()
        .map_err(|_| "local-storage-denied")?
        .ok_or("local-storage-unavailable")?;
    storage
        .length()
        .map(u64::from)
        .map_err(|_| "local-storage-count-failed")
}

async fn old_indexed_db_rows() -> Vec<StorageInventoryRow> {
    let Some(window) = web_sys::window() else {
        return vec![old_indexed_db_status_row("unavailable", "missing-window")];
    };
    let Ok(factory) = Reflect::get(window.as_ref(), &JsValue::from_str("indexedDB")) else {
        return vec![old_indexed_db_status_row(
            "unavailable",
            "indexeddb-unavailable",
        )];
    };
    if factory.is_null() || factory.is_undefined() {
        return vec![old_indexed_db_status_row(
            "unavailable",
            "indexeddb-unavailable",
        )];
    }
    let Ok(databases) = Reflect::get(&factory, &JsValue::from_str("databases")) else {
        return vec![old_indexed_db_status_row(
            "unsupported",
            "indexeddb-databases-unsupported",
        )];
    };
    let Ok(function) = databases.dyn_into::<Function>() else {
        return vec![old_indexed_db_status_row(
            "unsupported",
            "indexeddb-databases-unsupported",
        )];
    };
    let Ok(promise) = function
        .call0(&factory)
        .and_then(|value| value.dyn_into::<Promise>())
    else {
        return vec![old_indexed_db_status_row(
            "unavailable",
            "indexeddb-databases-failed",
        )];
    };
    match JsFuture::from(promise).await {
        Ok(value) if Array::is_array(&value) => old_indexed_db_database_rows(Array::from(&value)),
        Ok(_) => vec![old_indexed_db_status_row(
            "unavailable",
            "indexeddb-databases-malformed",
        )],
        Err(_) => vec![old_indexed_db_status_row(
            "unavailable",
            "indexeddb-databases-failed",
        )],
    }
}

fn old_indexed_db_database_rows(databases: Array) -> Vec<StorageInventoryRow> {
    databases
        .iter()
        .filter_map(|item| Reflect::get(&item, &JsValue::from_str("name")).ok())
        .filter_map(|name| name.as_string())
        .filter(|name| !name.is_empty())
        .map(|name| StorageInventoryRow {
            table: format!("old-indexeddb:{name}"),
            data_class: "unknown-legacy-or-unowned-storage".to_string(),
            group: "unknown".to_string(),
            status: "estimated".to_string(),
            row_count: None,
            problem_reason: Some("old IndexedDB database presence; row scan skipped".to_string()),
        })
        .collect()
}

fn old_indexed_db_status_row(status: &str, reason: &str) -> StorageInventoryRow {
    StorageInventoryRow {
        table: "old-indexeddb:list".to_string(),
        data_class: "unknown-legacy-or-unowned-storage".to_string(),
        group: "unknown".to_string(),
        status: status.to_string(),
        row_count: None,
        problem_reason: Some(reason.to_string()),
    }
}
