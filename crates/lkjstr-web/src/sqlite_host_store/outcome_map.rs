use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

use crate::sqlite_store::SqliteStore;
use crate::storage_worker::StorageWorkerClient;

pub(super) fn map_worker_error(
    outcome: StorageOutcome<StorageWorkerClient>,
) -> StorageOutcome<SqliteStore> {
    match outcome {
        StorageOutcome::Ok(_) => unexpected_open_state("worker-client"),
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

pub(super) fn map_unit_error(outcome: StorageOutcome<()>) -> StorageOutcome<SqliteStore> {
    match outcome {
        StorageOutcome::Ok(()) => unexpected_open_state("cooldown"),
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

pub(super) fn unexpected_open_state(operation_id: &'static str) -> StorageOutcome<SqliteStore> {
    StorageOutcome::Corrupt(StorageProblem::new(
        StorageOperation::Transaction,
        "sqlite_worker",
        "unexpected-open-state",
        operation_id,
    ))
}
