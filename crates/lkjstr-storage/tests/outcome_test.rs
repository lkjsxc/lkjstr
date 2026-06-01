use lkjstr_storage::{StorageOperation, StorageOutcome, StorageProblem};

#[test]
fn storage_problem_records_operation_context() {
    let problem = StorageProblem::new(
        StorageOperation::Inventory,
        "events",
        "timeout",
        "operation-1",
    );

    assert_eq!(problem.operation.as_str(), "inventory");
    assert_eq!(problem.table, "events");
    assert_eq!(problem.reason, "timeout");
    assert_eq!(problem.operation_id, "operation-1");
}

#[test]
fn outcome_exposes_problem_for_non_ok_states() {
    let problem = StorageProblem::new(StorageOperation::Read, "settings", "blocked", "read-1");
    let outcome: StorageOutcome<()> = StorageOutcome::Blocked(problem.clone());

    assert!(!outcome.is_ok());
    assert_eq!(outcome.problem(), Some(&problem));
    assert!(StorageOutcome::Ok(1).is_ok());
    assert_eq!(StorageOutcome::Ok(1).problem(), None);
}

#[test]
fn timeout_and_late_outcomes_keep_problem_context() {
    let timeout = StorageProblem::new(
        StorageOperation::Transaction,
        "accounts",
        "timeout",
        "local-account",
    );
    let late = StorageProblem::new(
        StorageOperation::Transaction,
        "accounts",
        "late-settled",
        "local-account",
    );

    let timeout_outcome: StorageOutcome<()> = StorageOutcome::Timeout(timeout.clone());
    let late_outcome: StorageOutcome<()> = StorageOutcome::LateSettled(late.clone());

    assert_eq!(timeout_outcome.problem(), Some(&timeout));
    assert_eq!(late_outcome.problem(), Some(&late));
    assert!(!timeout_outcome.is_ok());
    assert!(!late_outcome.is_ok());
}

#[test]
fn busy_and_canceled_outcomes_keep_problem_context() {
    let busy = StorageProblem::new(StorageOperation::Write, "events", "busy", "write-1");
    let canceled = StorageProblem::new(StorageOperation::Read, "events", "canceled", "read-1");

    let busy_outcome: StorageOutcome<()> = StorageOutcome::Busy(busy.clone());
    let canceled_outcome: StorageOutcome<()> = StorageOutcome::Canceled(canceled.clone());

    assert_eq!(busy_outcome.problem(), Some(&busy));
    assert_eq!(canceled_outcome.problem(), Some(&canceled));
    assert!(!busy_outcome.is_ok());
    assert!(!canceled_outcome.is_ok());
}
