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
