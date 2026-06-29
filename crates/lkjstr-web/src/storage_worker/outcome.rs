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
    let reason = reason_for_response(&response, outcome);
    let problem = problem(op, reason, response.request_id.clone());
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
        StorageOp::EstimateStorage
        | StorageOp::GetStorageHealth
        | StorageOp::ReadPhysicalInventory => StorageOperation::Inventory,
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

fn reason_for_response(response: &StorageResponse, outcome: WorkerOutcome) -> &'static str {
    match response.diagnostics.owner_reason.as_deref() {
        Some("sahpool-lock-conflict" | "web-lock-held") => "opfs-owner-held",
        Some("web-lock-unavailable") => "web-lock-unavailable",
        _ => reason(outcome),
    }
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

#[cfg(test)]
mod tests {
    use lkjstr_storage::{StorageOperation, StorageOutcome};

    use super::*;
    use crate::storage_worker::StorageDiagnostics;

    #[test]
    fn owner_conflict_busy_response_uses_stable_problem_reason() {
        let outcome = map_worker_response(
            StorageResponse {
                request_id: "open-1".to_owned(),
                outcome: WorkerOutcome::Busy,
                rows: Vec::new(),
                rows_affected: 0,
                diagnostics: StorageDiagnostics {
                    owner_reason: Some("sahpool-lock-conflict".to_owned()),
                    ..Default::default()
                },
            },
            StorageOperation::Transaction,
        );

        assert!(matches!(outcome, StorageOutcome::Busy(_)));
        if let StorageOutcome::Busy(problem) = outcome {
            assert_eq!(problem.reason, "opfs-owner-held");
        }
    }
}
