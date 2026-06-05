use std::cell::RefCell;

use lkjstr_storage::StorageOutcome;

use crate::{sqlite_store::SqliteStore, storage_worker::StorageWorkerClient};

const STORE_DEADLINE_MS: u32 = 5_000;
const STORE_CACHE_LIMIT: usize = 4;

thread_local! {
    // One worker-owned store per recent database keeps temporary memory mode real
    // for Settings while bounding test-created database handles.
    static SETTINGS_STORES: RefCell<Vec<NamedStore>> = const { RefCell::new(Vec::new()) };
}

#[derive(Clone)]
struct NamedStore {
    key: String,
    store: SqliteStore,
}

pub async fn open_settings_store(db_name: &str, worker_url: &str) -> StorageOutcome<SqliteStore> {
    let key = store_key(db_name, worker_url);
    if let Some(store) = cached_store(&key) {
        return StorageOutcome::Ok(store);
    }
    let client = match StorageWorkerClient::new_module(worker_url) {
        StorageOutcome::Ok(client) => client,
        outcome => {
            return outcome.map(|client| SqliteStore::from_client(client, STORE_DEADLINE_MS));
        }
    };
    let opened = SqliteStore::open(client, db_name.to_owned(), STORE_DEADLINE_MS).await;
    if let StorageOutcome::Ok(store) = &opened {
        cache_store(key, store.clone());
    }
    opened
}

fn cached_store(key: &str) -> Option<SqliteStore> {
    SETTINGS_STORES.with_borrow(|stores| {
        stores
            .iter()
            .find(|entry| entry.key == key)
            .map(|entry| entry.store.clone())
    })
}

fn cache_store(key: String, store: SqliteStore) {
    SETTINGS_STORES.with_borrow_mut(|stores| {
        stores.retain(|entry| entry.key != key);
        stores.push(NamedStore { key, store });
        while stores.len() > STORE_CACHE_LIMIT {
            stores.remove(0);
        }
    });
}

fn store_key(db_name: &str, worker_url: &str) -> String {
    format!("{worker_url}\n{db_name}")
}
