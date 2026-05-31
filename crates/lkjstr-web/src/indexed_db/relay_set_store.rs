use lkjstr_domain::sorted_relay_sets;
use lkjstr_storage::{RelaySetRecord, StorageOutcome, relay_set_record_id};

use crate::indexed_db::database::{DEFAULT_DB_NAME, RELAY_SETS_TABLE};
use crate::indexed_db::{record_requests, record_write};

pub async fn default_relay_sets_all() -> StorageOutcome<Vec<RelaySetRecord>> {
    relay_sets_all(DEFAULT_DB_NAME).await
}

pub async fn relay_set_put(db_name: &str, row: &RelaySetRecord) -> StorageOutcome<()> {
    record_write::put(db_name, RELAY_SETS_TABLE, relay_set_record_id(row), row).await
}

pub async fn relay_set_get(db_name: &str, id: &str) -> StorageOutcome<Option<RelaySetRecord>> {
    record_requests::get(db_name, RELAY_SETS_TABLE, id).await
}

pub async fn relay_sets_all(db_name: &str) -> StorageOutcome<Vec<RelaySetRecord>> {
    let values =
        match record_requests::all_values(db_name, RELAY_SETS_TABLE, "relay-sets-all".to_owned())
            .await
        {
            StorageOutcome::Ok(values) => values,
            outcome => return outcome.map(|_| Vec::new()),
        };
    let rows = values
        .into_iter()
        .filter_map(|value| serde_wasm_bindgen::from_value::<RelaySetRecord>(value).ok())
        .collect::<Vec<_>>();
    StorageOutcome::Ok(sorted_relay_sets(rows))
}

pub async fn relay_sets_put_all(db_name: &str, rows: &[RelaySetRecord]) -> StorageOutcome<()> {
    for row in rows {
        match relay_set_put(db_name, row).await {
            StorageOutcome::Ok(()) => {}
            outcome => return outcome,
        }
    }
    StorageOutcome::Ok(())
}
