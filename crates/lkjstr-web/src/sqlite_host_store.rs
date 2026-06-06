use std::future::Future;

use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

use crate::{sqlite_store::SqliteStore, storage_worker::StorageWorkerClient};

const STORE_DEADLINE_MS: u32 = 5_000;

pub async fn open_sqlite_store(db_name: &str, worker_url: &str) -> StorageOutcome<SqliteStore> {
    let client = match StorageWorkerClient::new_module(worker_url) {
        StorageOutcome::Ok(client) => client,
        outcome => {
            return outcome.map(|client| SqliteStore::from_client(client, STORE_DEADLINE_MS));
        }
    };
    SqliteStore::open(client, db_name.to_owned(), STORE_DEADLINE_MS).await
}

pub async fn with_sqlite_store<T, F, Fut>(
    db_name: &str,
    worker_url: &str,
    operation: F,
) -> StorageOutcome<T>
where
    F: FnOnce(SqliteStore) -> Fut,
    Fut: Future<Output = StorageOutcome<T>>,
{
    let store = match open_sqlite_store(db_name, worker_url).await {
        StorageOutcome::Ok(store) => store,
        outcome => return map_open_error(outcome),
    };
    let result = operation(store.clone()).await;
    let _closed = store.close().await;
    result
}

fn map_open_error<T>(outcome: StorageOutcome<SqliteStore>) -> StorageOutcome<T> {
    match outcome {
        StorageOutcome::Ok(_) => StorageOutcome::Corrupt(StorageProblem::new(
            StorageOperation::Transaction,
            "sqlite_worker",
            "unexpected-open-state",
            "with_sqlite_store",
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
