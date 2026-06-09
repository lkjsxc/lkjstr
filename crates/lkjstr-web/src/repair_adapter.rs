#![doc = "Storage repair adapter outcome mapping."]

use lkjstr_storage::{
    RepairBackfillInput, RepairBackfillOutput, RepairFinding, RepairFindingKind,
    RepairInventoryReportInput, RepairInventoryReportOutput, RepairScanInput, RepairScanOutput,
    RepairTargetProbeInput, SqliteStorageHealth, StorageOutcome, plan_repair_backfill,
    report_repair_inventory, scan_repair,
};

pub fn repair_scan_after_health(
    input: RepairScanInput,
    health: StorageOutcome<SqliteStorageHealth>,
) -> StorageOutcome<RepairScanOutput> {
    let temporary = match temporary_memory_mode(health) {
        Ok(temporary) => temporary,
        Err(outcome) => return outcome,
    };
    let mut next = input;
    next.temporary_memory_mode |= temporary;
    StorageOutcome::Ok(scan_repair(next))
}

pub fn repair_inventory_after_health(
    input: RepairInventoryReportInput,
    health: StorageOutcome<SqliteStorageHealth>,
) -> StorageOutcome<RepairInventoryReportOutput> {
    let temporary = match temporary_memory_mode(health) {
        Ok(temporary) => temporary,
        Err(outcome) => return outcome,
    };
    let mut next = input;
    next.temporary_memory_mode |= temporary;
    StorageOutcome::Ok(report_repair_inventory(next))
}

pub fn repair_probe_input_after_health(
    input: RepairTargetProbeInput,
    health: StorageOutcome<SqliteStorageHealth>,
) -> StorageOutcome<RepairTargetProbeInput> {
    let temporary = match temporary_memory_mode(health) {
        Ok(temporary) => temporary,
        Err(outcome) => return outcome,
    };
    let mut next = input;
    next.temporary_memory_mode |= temporary;
    StorageOutcome::Ok(next)
}

pub fn repair_backfill_after_health(
    input: RepairBackfillInput,
    health: StorageOutcome<SqliteStorageHealth>,
) -> StorageOutcome<RepairBackfillOutput> {
    let temporary = match temporary_memory_mode(health) {
        Ok(temporary) => temporary,
        Err(outcome) => return outcome,
    };
    let mut output = plan_repair_backfill(input);
    if temporary {
        output.findings.insert(
            0,
            RepairFinding::new(
                RepairFindingKind::TemporaryMemoryMode,
                "cache_ledger",
                "storage",
            ),
        );
    }
    StorageOutcome::Ok(output)
}

fn temporary_memory_mode<T>(
    health: StorageOutcome<SqliteStorageHealth>,
) -> Result<bool, StorageOutcome<T>> {
    match health {
        StorageOutcome::Ok(health) => Ok(health.mode == "temporary-memory"),
        StorageOutcome::Unavailable(problem) => Err(StorageOutcome::Unavailable(problem)),
        StorageOutcome::Timeout(problem) => Err(StorageOutcome::Timeout(problem)),
        StorageOutcome::Busy(problem) => Err(StorageOutcome::Busy(problem)),
        StorageOutcome::Blocked(problem) => Err(StorageOutcome::Blocked(problem)),
        StorageOutcome::Quota(problem) => Err(StorageOutcome::Quota(problem)),
        StorageOutcome::Corrupt(problem) => Err(StorageOutcome::Corrupt(problem)),
        StorageOutcome::Canceled(problem) => Err(StorageOutcome::Canceled(problem)),
        StorageOutcome::LateSettled(problem) => Err(StorageOutcome::LateSettled(problem)),
        StorageOutcome::LateRejected(problem) => Err(StorageOutcome::LateRejected(problem)),
    }
}
