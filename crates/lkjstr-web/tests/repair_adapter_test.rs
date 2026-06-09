use lkjstr_storage::{
    RepairFindingKind, RepairInventoryReportInput, RepairScanInput, RepairScanRow,
    RepairTargetProbeInput, RepairTargetState, SqliteStorageHealth, StorageOperation,
    StorageOutcome, StorageProblem,
};
use lkjstr_web::repair_adapter::{
    repair_inventory_after_health, repair_probe_input_after_health, repair_scan_after_health,
};

#[test]
fn repair_scan_after_health_marks_temporary_memory() -> Result<(), String> {
    let output = match repair_scan_after_health(scan_input(Vec::new()), health("temporary-memory"))
    {
        StorageOutcome::Ok(output) => output,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    assert!(
        output
            .findings
            .iter()
            .any(|finding| finding.kind == RepairFindingKind::TemporaryMemoryMode)
    );
    Ok(())
}

#[test]
fn repair_scan_after_health_propagates_timeout() -> Result<(), String> {
    let problem = StorageProblem::new(
        StorageOperation::Inventory,
        "sqlite_worker",
        "timeout",
        "r1",
    );
    match repair_scan_after_health(
        scan_input(Vec::new()),
        StorageOutcome::Timeout(problem.clone()),
    ) {
        StorageOutcome::Timeout(actual) => assert_eq!(actual, problem),
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    }
    Ok(())
}

#[test]
fn repair_scan_after_health_keeps_unknown_rows_unsafe() -> Result<(), String> {
    let output = match repair_scan_after_health(
        scan_input(vec![RepairScanRow {
            table_name: "mystery".to_owned(),
            resource_id: "raw-1".to_owned(),
            ledger_state: RepairTargetState::Present,
            target_state: RepairTargetState::Missing,
            protected: false,
            known_owner: false,
            decode_ok: true,
            corrupt: false,
        }]),
        health("persistent-opfs"),
    ) {
        StorageOutcome::Ok(output) => output,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    let kinds: Vec<_> = output.findings.iter().map(|finding| finding.kind).collect();
    assert!(kinds.contains(&RepairFindingKind::UnknownUnownedRow));
    assert!(kinds.contains(&RepairFindingKind::SkippedUnknownRow));
    Ok(())
}

#[test]
fn repair_inventory_after_health_surfaces_temporary_memory() -> Result<(), String> {
    let output = match repair_inventory_after_health(
        RepairInventoryReportInput {
            inventory_complete: true,
            temporary_memory_mode: false,
            table_count: 2,
            next_cursor: None,
        },
        health("temporary-memory"),
    ) {
        StorageOutcome::Ok(output) => output,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    assert_eq!(output.table_count, 2);
    assert!(
        output
            .findings
            .iter()
            .any(|finding| finding.kind == RepairFindingKind::TemporaryMemoryMode)
    );
    Ok(())
}

#[test]
fn repair_probe_input_after_health_surfaces_temporary_memory() -> Result<(), String> {
    let output = match repair_probe_input_after_health(probe_input(), health("temporary-memory")) {
        StorageOutcome::Ok(output) => output,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    assert!(output.temporary_memory_mode);
    Ok(())
}

#[test]
fn repair_probe_input_after_health_propagates_timeout() -> Result<(), String> {
    let problem = StorageProblem::new(
        StorageOperation::Inventory,
        "sqlite_worker",
        "timeout",
        "probe",
    );
    match repair_probe_input_after_health(probe_input(), StorageOutcome::Timeout(problem.clone())) {
        StorageOutcome::Timeout(actual) => assert_eq!(actual, problem),
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    }
    Ok(())
}

fn scan_input(rows: Vec<RepairScanRow>) -> RepairScanInput {
    RepairScanInput {
        rows,
        after_resource_id: None,
        limit: 10,
        inventory_complete: true,
        temporary_memory_mode: false,
        schema_matches: true,
    }
}

fn probe_input() -> RepairTargetProbeInput {
    RepairTargetProbeInput {
        targets: Vec::new(),
        after_resource_id: None,
        limit: 10,
        inventory_complete: true,
        temporary_memory_mode: false,
        schema_matches: true,
    }
}

fn health(mode: &str) -> StorageOutcome<SqliteStorageHealth> {
    StorageOutcome::Ok(SqliteStorageHealth {
        mode: mode.to_owned(),
        vfs_name: "opfs-sahpool".to_owned(),
        worker_kind: "classic".to_owned(),
        sqlite_version: "3".to_owned(),
        database_name: "test.sqlite3".to_owned(),
        applied_schema_changes: Vec::new(),
        page_count: 0,
        page_size: 0,
        freelist_count: 0,
        event_count: 0,
        relay_receipt_count: 0,
        tag_row_count: 0,
        last_integrity_check_at: None,
        warnings: Vec::new(),
    })
}
