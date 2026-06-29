use std::future::Future;

use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

use crate::sqlite_store::SqliteStore;

mod registry;

const STORE_DEADLINE_MS: u32 = 5_000;

pub async fn open_sqlite_store(db_name: &str, worker_url: &str) -> StorageOutcome<SqliteStore> {
    registry::store_for(db_name, worker_url, STORE_DEADLINE_MS).await
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
    operation(store.clone()).await
}

pub async fn close_all_sqlite_stores() -> usize {
    registry::close_all().await
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

#[cfg(test)]
mod tests {
    #[test]
    fn with_sqlite_store_does_not_close_after_operation() -> Result<(), String> {
        let source = include_str!("sqlite_host_store.rs");
        let start = source
            .find("pub async fn with_sqlite_store")
            .ok_or_else(|| "missing with_sqlite_store".to_owned())?;
        let end = source
            .find("pub async fn close_all_sqlite_stores")
            .ok_or_else(|| "missing close_all_sqlite_stores".to_owned())?;
        assert!(!source[start..end].contains(".close()"));
        Ok(())
    }
}
