use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

use crate::storage_worker::types::{StorageOp, StorageResponse, WorkerOutcome};

pub const STORAGE_WORKER_TABLE: &str = "sqlite_worker";

pub fn map_worker_response(
    response: StorageResponse,
    op: StorageOperation,
) -> StorageOutcome<StorageResponse> {
    let outcome = response.outcome;
    if outcome == WorkerOutcome::Ok {
        return StorageOutcome::Ok(response);
    }
    let problem = problem(op, reason(outcome), response.request_id.clone());
    match outcome {
        WorkerOutcome::Ok => StorageOutcome::Ok(response),
        WorkerOutcome::Unavailable => StorageOutcome::Unavailable(problem),
        WorkerOutcome::Timeout => StorageOutcome::Timeout(problem),
        WorkerOutcome::Busy => StorageOutcome::Busy(problem),
        WorkerOutcome::Blocked => StorageOutcome::Blocked(problem),
        WorkerOutcome::Quota => StorageOutcome::Quota(problem),
        WorkerOutcome::Corrupt => StorageOutcome::Corrupt(problem),
        WorkerOutcome::Canceled => StorageOutcome::Canceled(problem),
        WorkerOutcome::LateSettled => StorageOutcome::LateSettled(problem),
        WorkerOutcome::LateRejected => StorageOutcome::LateRejected(problem),
    }
}

pub fn local_response(request_id: &str, outcome: WorkerOutcome) -> StorageResponse {
    StorageResponse {
        request_id: request_id.to_owned(),
        outcome,
        rows: Vec::new(),
        rows_affected: 0,
        diagnostics: Default::default(),
    }
}

pub fn operation_for(op: &StorageOp) -> StorageOperation {
    match op {
        StorageOp::Query { .. } => StorageOperation::Read,
        StorageOp::EstimateStorage => StorageOperation::Inventory,
        StorageOp::Execute { .. } => StorageOperation::Write,
        StorageOp::Open { .. }
        | StorageOp::Close
        | StorageOp::ApplySchema { .. }
        | StorageOp::Batch { .. }
        | StorageOp::Cancel { .. } => StorageOperation::Transaction,
    }
}

pub fn problem(
    op: StorageOperation,
    reason: &'static str,
    request_id: impl Into<String>,
) -> StorageProblem {
    StorageProblem::new(op, STORAGE_WORKER_TABLE, reason, request_id)
}

fn reason(outcome: WorkerOutcome) -> &'static str {
    match outcome {
        WorkerOutcome::Ok => "ok",
        WorkerOutcome::Unavailable => "unavailable",
        WorkerOutcome::Timeout => "timeout",
        WorkerOutcome::Busy => "busy",
        WorkerOutcome::Blocked => "blocked",
        WorkerOutcome::Quota => "quota",
        WorkerOutcome::Corrupt => "corrupt",
        WorkerOutcome::Canceled => "canceled",
        WorkerOutcome::LateSettled => "late-settled",
        WorkerOutcome::LateRejected => "late-rejected",
    }
}
