use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use futures::FutureExt;
use futures::future::{LocalBoxFuture, Shared};
use lkjstr_storage::StorageOutcome;

use super::cooldown;
use super::outcome_map::{map_unit_error, map_worker_error, unexpected_open_state};
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
    if let Some(outcome) = cooldown::active_owner_block(database_name, worker_url) {
        return map_unit_error(outcome);
    }
    let entry = match shared_entry(database_name, worker_url, deadline_ms) {
        StorageOutcome::Ok(entry) => entry,
        outcome => return map_entry_error(outcome),
    };
    let mut outcome = entry.store().await;
    if let StorageOutcome::Ok(store) = &outcome
        && store.is_closed()
    {
        remove_entry(database_name, worker_url);
        let replacement = match shared_entry(database_name, worker_url, deadline_ms) {
            StorageOutcome::Ok(entry) => entry,
            outcome => return map_entry_error(outcome),
        };
        outcome = replacement.store().await;
    }
    if !outcome.is_ok() {
        cooldown::start_if_owner_blocked(database_name, worker_url, &outcome);
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
    let database_name = database_name.to_owned();
    let worker_url = worker_url.to_owned();
    let open = async move {
        match StorageWorkerClient::new_app_broker(&worker_url, &database_name).await {
            StorageOutcome::Ok(client) => SqliteStore::open(client, database_name, deadline_ms).await,
            outcome => map_worker_error(outcome),
        }
    }
    .boxed_local()
    .shared();
    StorageOutcome::Ok(Rc::new(RegistryEntry { open }))
}

fn map_entry_error(outcome: StorageOutcome<Rc<RegistryEntry>>) -> StorageOutcome<SqliteStore> {
    match outcome {
        StorageOutcome::Ok(_) => unexpected_open_state("registry-entry"),
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
#[path = "registry_tests.rs"]
mod tests;
