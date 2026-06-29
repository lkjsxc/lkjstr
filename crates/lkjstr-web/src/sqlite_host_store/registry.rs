use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use futures::FutureExt;
use futures::future::{LocalBoxFuture, Shared};
use lkjstr_storage::StorageOutcome;

use crate::sqlite_store::SqliteStore;
use crate::storage_worker::StorageWorkerClient;

type OpenFuture = Shared<LocalBoxFuture<'static, StorageOutcome<SqliteStore>>>;

thread_local! {
    static REGISTRY: RefCell<BTreeMap<StoreKey, Rc<RegistryEntry>>> = const { RefCell::new(BTreeMap::new()) };
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct StoreKey {
    database_name: String,
    worker_url: String,
}

struct RegistryEntry {
    open: OpenFuture,
}

pub(super) async fn store_for(
    database_name: &str,
    worker_url: &str,
    deadline_ms: u32,
) -> StorageOutcome<SqliteStore> {
    let entry = match shared_entry(database_name, worker_url, deadline_ms) {
        StorageOutcome::Ok(entry) => entry,
        outcome => return map_entry_error(outcome),
    };
    let outcome = entry.store().await;
    if !outcome.is_ok() {
        remove_entry(database_name, worker_url);
    }
    outcome
}

fn shared_entry(
    database_name: &str,
    worker_url: &str,
    deadline_ms: u32,
) -> StorageOutcome<Rc<RegistryEntry>> {
    let key = StoreKey::new(database_name, worker_url);
    REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();
        if let Some(entry) = registry.get(&key) {
            return StorageOutcome::Ok(entry.clone());
        }
        let entry = match create_entry(database_name, worker_url, deadline_ms) {
            StorageOutcome::Ok(entry) => entry,
            outcome => return outcome,
        };
        registry.insert(key, entry.clone());
        StorageOutcome::Ok(entry)
    })
}

pub(super) async fn close_all() -> usize {
    let entries = REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();
        std::mem::take(&mut *registry)
            .into_values()
            .collect::<Vec<_>>()
    });
    let mut closed = 0;
    for entry in entries {
        if let StorageOutcome::Ok(store) = entry.open.clone().await {
            let _outcome = store.close().await;
            closed += 1;
        }
    }
    closed
}

fn remove_entry(database_name: &str, worker_url: &str) {
    let key = StoreKey::new(database_name, worker_url);
    REGISTRY.with(|registry| {
        registry.borrow_mut().remove(&key);
    });
}

impl RegistryEntry {
    pub(super) async fn store(&self) -> StorageOutcome<SqliteStore> {
        self.open.clone().await
    }
}

impl StoreKey {
    fn new(database_name: &str, worker_url: &str) -> Self {
        Self {
            database_name: database_name.to_owned(),
            worker_url: worker_url.to_owned(),
        }
    }
}

fn create_entry(
    database_name: &str,
    worker_url: &str,
    deadline_ms: u32,
) -> StorageOutcome<Rc<RegistryEntry>> {
    StorageWorkerClient::new_module(worker_url).map(|client| {
        let database_name = database_name.to_owned();
        let open = async move { SqliteStore::open(client, database_name, deadline_ms).await }
            .boxed_local()
            .shared();
        Rc::new(RegistryEntry { open })
    })
}

fn map_entry_error(outcome: StorageOutcome<Rc<RegistryEntry>>) -> StorageOutcome<SqliteStore> {
    match outcome {
        StorageOutcome::Ok(_) => StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
            lkjstr_storage::StorageOperation::Transaction,
            "sqlite_worker",
            "unexpected-open-state",
            "registry-entry",
        )),
        StorageOutcome::Unavailable(problem) => StorageOutcome::Unavailable(problem),
        StorageOutcome::Timeout(problem) => StorageOutcome::Timeout(problem),
        StorageOutcome::Busy(problem) => StorageOutcome::Busy(problem),
        StorageOutcome::Blocked(problem) => StorageOutcome::Blocked(problem),
        StorageOutcome::Quota(problem) => StorageOutcome::Quota(problem),
        StorageOutcome::Corrupt(problem) => StorageOutcome::Corrupt(problem),
        StorageOutcome::Canceled(problem) => StorageOutcome::Canceled(problem),
        StorageOutcome::LateSettled(problem) => StorageOutcome::LateSettled(problem),
        StorageOutcome::LateRejected(problem) => StorageOutcome::LateRejected(problem),
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use futures::executor::block_on;

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
}
