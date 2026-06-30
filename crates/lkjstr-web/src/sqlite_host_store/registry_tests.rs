use std::cell::Cell;

use futures::FutureExt;
use futures::executor::block_on;
use lkjstr_storage::StorageOutcome;

use super::*;

#[test]
fn storage_worker_registry_key_reuses_database_and_worker_owner() {
    let mut entries = BTreeMap::new();
    let key = StoreKey::new("/lkjstr/main.sqlite3", "/sqlite-opfs-worker.js");
    entries.insert(key.clone(), 1_u8);

    assert_eq!(entries.get(&key), Some(&1));
    assert_eq!(entries.len(), 1);
}

#[test]
fn persistent_registry_borrows_the_app_broker() {
    let source = include_str!("registry.rs");
    let owned = "StorageWorkerClient::new_".to_owned() + "owned_module";
    let module = "StorageWorkerClient::new_".to_owned() + "module(worker_url)";
    assert!(source.contains("StorageWorkerClient::new_app_broker"));
    assert!(!source.contains(&owned));
    assert!(!source.contains(&module));
}

#[test]
fn storage_worker_open_future_is_shared_between_callers() {
    let opens = Rc::new(Cell::new(0));
    let opens_for_future = opens.clone();
    let future = async move {
        opens_for_future.set(opens_for_future.get() + 1);
        StorageOutcome::Ok(7_u8)
    }
    .boxed_local()
    .shared();

    let first = block_on(future.clone());
    let second = block_on(future);

    assert_eq!(first, StorageOutcome::Ok(7));
    assert_eq!(second, StorageOutcome::Ok(7));
    assert_eq!(opens.get(), 1);
}
