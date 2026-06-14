#![doc = "localStorage inventory rows."]

use lkjstr_storage::StorageInventoryRow;

pub fn local_storage_row() -> StorageInventoryRow {
    match local_storage_inventory() {
        Ok((count, estimated_bytes)) => StorageInventoryRow {
            table: "localStorage".to_string(),
            data_class: "non-indexed-browser-storage".to_string(),
            group: "non-indexed".to_string(),
            status: "available".to_string(),
            row_count: Some(count),
            estimated_bytes: Some(estimated_bytes),
            problem_reason: None,
        },
        Err(reason) => StorageInventoryRow {
            table: "localStorage".to_string(),
            data_class: "non-indexed-browser-storage".to_string(),
            group: "non-indexed".to_string(),
            status: "unavailable".to_string(),
            row_count: None,
            estimated_bytes: None,
            problem_reason: Some(reason.to_string()),
        },
    }
}

fn local_storage_inventory() -> Result<(u64, u64), &'static str> {
    let Some(window) = web_sys::window() else {
        return Err("missing-window");
    };
    let storage = window
        .local_storage()
        .map_err(|_| "local-storage-denied")?
        .ok_or("local-storage-unavailable")?;
    let count = storage
        .length()
        .map_err(|_| "local-storage-count-failed")?;
    let mut estimated_bytes = 0_u64;
    for index in 0..count {
        let Some(key) = storage
            .key(index)
            .map_err(|_| "local-storage-key-read-failed")?
        else {
            continue;
        };
        let value = storage
            .get_item(&key)
            .map_err(|_| "local-storage-value-read-failed")?;
        estimated_bytes = estimated_bytes
            .saturating_add(json_bytes(&key))
            .saturating_add(value.as_deref().map_or(4, json_bytes));
    }
    Ok((u64::from(count), estimated_bytes))
}

fn json_bytes(value: &str) -> u64 {
    serde_json::to_vec(value)
        .map(|bytes| bytes.len() as u64)
        .unwrap_or(u64::MAX)
}
