#![doc = "Browser-owned storage inventory rows for Rust Stats."]

mod cache_storage;
mod local_storage;
mod old_indexed_db;

use lkjstr_storage::StorageInventoryRow;

pub async fn browser_inventory_rows() -> Vec<StorageInventoryRow> {
    let mut rows = vec![local_storage::local_storage_row()];
    rows.extend(cache_storage::cache_storage_rows().await);
    rows.extend(old_indexed_db::old_indexed_db_rows().await);
    rows
}
