#![doc = "Browser-owned storage inventory rows for Rust Stats."]

use lkjstr_storage::StorageInventoryRow;

pub fn browser_inventory_rows() -> Vec<StorageInventoryRow> {
    vec![local_storage_row()]
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
