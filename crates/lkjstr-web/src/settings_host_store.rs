use lkjstr_storage::StorageOutcome;

use crate::{sqlite_store::SqliteStore, storage_worker::StorageWorkerClient};

const STORE_DEADLINE_MS: u32 = 5_000;

pub async fn open_settings_store(db_name: &str, worker_url: &str) -> StorageOutcome<SqliteStore> {
    let client = match StorageWorkerClient::new_module(worker_url) {
        StorageOutcome::Ok(client) => client,
        outcome => {
            return outcome.map(|client| SqliteStore::from_client(client, STORE_DEADLINE_MS));
        }
    };
    SqliteStore::open(client, db_name.to_owned(), STORE_DEADLINE_MS).await
}
