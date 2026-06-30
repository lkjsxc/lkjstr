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
    let reason = reason_for_response(&response, outcome, op);
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

fn reason_for_response(
    response: &StorageResponse,
    outcome: WorkerOutcome,
    op: StorageOperation,
) -> &'static str {
    if let Some(reason) = owner_reason(response.diagnostics.owner_reason.as_deref()) {
        return reason;
    }
    if let Some(reason) = message_reason(response.diagnostics.message.as_deref(), op) {
        return reason;
    }
    reason(outcome)
}

fn owner_reason(reason: Option<&str>) -> Option<&'static str> {
    match reason {
        Some("sahpool-lock-conflict" | "web-lock-held") => Some("opfs-owner-held"),
        Some("web-lock-unavailable") => Some("web-lock-unavailable"),
        Some("browser-unsupported") => Some("browser-unsupported"),
        Some("worker-construction-failed") => Some("worker-construction-failed"),
        Some("worker-open-failed") => Some("worker-open-failed"),
        Some("sqlite-open-failed") => Some("sqlite-open-failed"),
        Some("storage-blocked") => Some("storage-blocked"),
        _ => None,
    }
}

fn message_reason(message: Option<&str>, op: StorageOperation) -> Option<&'static str> {
    let message = message?;
    if message.contains("Worker unsupported") {
        return Some("browser-unsupported");
    }
    if message.contains("Worker construction failed") {
        return Some("worker-construction-failed");
    }
    if message.contains("SQLite worker failed") {
        return Some("worker-open-failed");
    }
    if op == StorageOperation::Transaction && looks_like_sqlite_open_failure(message) {
        return Some("sqlite-open-failed");
    }
    if message.contains("NoModificationAllowedError") || message.contains("Access Handle") {
        return Some("opfs-owner-held");
    }
    let lower = message.to_ascii_lowercase();
    if lower.contains("blocked") || lower.contains("denied") || lower.contains("permission") {
        return Some("storage-blocked");
    }
    None
}

fn looks_like_sqlite_open_failure(message: &str) -> bool {
    message.contains("OPFS SQLite storage is unavailable")
        || message.contains("SQLite database is not open")
        || message.contains("VFS missing")
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
        let outcome = mapped_with_diagnostics(
            WorkerOutcome::Busy,
            StorageDiagnostics {
                owner_reason: Some("sahpool-lock-conflict".to_owned()),
                ..Default::default()
            },
        );

        assert!(matches!(outcome, StorageOutcome::Busy(_)));
        assert_eq!(problem_reason(&outcome), "opfs-owner-held");
    }

    #[test]
    fn worker_failure_uses_precise_owner_reason() {
        let outcome = mapped_with_diagnostics(
            WorkerOutcome::Unavailable,
            StorageDiagnostics {
                owner_reason: Some("worker-construction-failed".to_owned()),
                ..Default::default()
            },
        );

        assert_eq!(problem_reason(&outcome), "worker-construction-failed");
    }

    #[test]
    fn sqlite_open_failure_message_gets_stable_reason() {
        let outcome = mapped_with_diagnostics(
            WorkerOutcome::Unavailable,
            StorageDiagnostics {
                message: Some("OPFS SQLite storage is unavailable: VFS missing".to_owned()),
                ..Default::default()
            },
        );

        assert_eq!(problem_reason(&outcome), "sqlite-open-failed");
    }

    fn mapped_with_diagnostics(
        outcome: WorkerOutcome,
        diagnostics: StorageDiagnostics,
    ) -> StorageOutcome<StorageResponse> {
        map_worker_response(
            StorageResponse {
                diagnostics,
                ..local_response("open-1", outcome)
            },
            StorageOperation::Transaction,
        )
    }

    fn problem_reason(outcome: &StorageOutcome<StorageResponse>) -> &'static str {
        outcome.problem().map_or("ok", |problem| problem.reason)
    }
}
