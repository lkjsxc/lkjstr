#![doc = "SQLite repair command adapter."]

use lkjstr_storage::{
    RepairBackfillInput, RepairBackfillOutput, RepairInventoryReportInput,
    RepairInventoryReportOutput, RepairScanInput, RepairScanOutput, StorageOutcome,
    repair_backfill_ledger_rows,
};

use crate::{
    repair_adapter::{
        repair_backfill_after_health, repair_inventory_after_health, repair_scan_after_health,
    },
    sqlite_store::{SqliteStore, cache_ledger::ledger_params},
};

pub async fn sqlite_repair_scan(
    store: &SqliteStore,
    input: RepairScanInput,
) -> StorageOutcome<RepairScanOutput> {
    repair_scan_after_health(input, store.storage_health().await)
}

pub async fn sqlite_repair_inventory_report(
    store: &SqliteStore,
    input: RepairInventoryReportInput,
) -> StorageOutcome<RepairInventoryReportOutput> {
    repair_inventory_after_health(input, store.storage_health().await)
}

pub async fn sqlite_repair_backfill(
    store: &SqliteStore,
    input: RepairBackfillInput,
) -> StorageOutcome<RepairBackfillOutput> {
    let rows = repair_backfill_ledger_rows(&input);
    let output = match repair_backfill_after_health(input, store.storage_health().await) {
        StorageOutcome::Ok(output) => output,
        outcome => return outcome.map(|_| empty_backfill_output()),
    };
    if rows.is_empty() {
        return StorageOutcome::Ok(output);
    }
    let mut steps = Vec::with_capacity(rows.len());
    for row in rows {
        match store.step("cache_ledger.upsert", ledger_params(row)) {
            StorageOutcome::Ok(step) => steps.push(step),
            outcome => return outcome.map(|_| empty_backfill_output()),
        }
    }
    store.batch(steps).await.map(|_| output)
}

fn empty_backfill_output() -> RepairBackfillOutput {
    RepairBackfillOutput {
        findings: Vec::new(),
        planned_count: 0,
        applied_count: 0,
        skipped_count: 0,
    }
}
