#![doc = "SQLite repair command adapter."]

use lkjstr_storage::{
    RepairBackfillInput, RepairBackfillOutput, RepairInventoryReportInput,
    RepairInventoryReportOutput, RepairProbeHit, RepairScanInput, RepairScanOutput,
    RepairTargetProbe, RepairTargetProbeInput, RepairTargetProbeOutput, RepairTargetState,
    StorageOutcome, finish_repair_target_probe, repair_backfill_ledger_rows, repair_probe_row,
    repair_probe_statement_id, repair_target_probe_batch,
};

use crate::{
    repair_adapter::{
        repair_backfill_after_health, repair_inventory_after_health,
        repair_probe_input_after_health, repair_scan_after_health,
    },
    sqlite_store::{SqliteStore, cache_ledger::ledger_params, params::params, params::text},
    storage_worker::SqlRow,
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

pub async fn sqlite_repair_probe_targets(
    store: &SqliteStore,
    input: RepairTargetProbeInput,
) -> StorageOutcome<RepairTargetProbeOutput> {
    let input = match repair_probe_input_after_health(input, store.storage_health().await) {
        StorageOutcome::Ok(input) => input,
        outcome => return outcome.map(|_| empty_probe_output()),
    };
    let batch = repair_target_probe_batch(&input);
    let mut rows = Vec::with_capacity(batch.targets.len());
    for target in &batch.targets {
        let Some(statement_id) = repair_probe_statement_id(target) else {
            rows.push(repair_probe_row(
                target,
                RepairTargetState::Unavailable,
                true,
                false,
            ));
            continue;
        };
        match query_probe_target(store, statement_id, target).await {
            StorageOutcome::Ok(row) => rows.push(row),
            outcome => return outcome.map(|_| empty_probe_output()),
        }
    }
    StorageOutcome::Ok(finish_repair_target_probe(input, rows))
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

async fn query_probe_target(
    store: &SqliteStore,
    statement_id: &'static str,
    target: &RepairTargetProbe,
) -> StorageOutcome<lkjstr_storage::RepairScanRow> {
    match store
        .query(
            statement_id,
            params(vec![text(target.resource_id.clone())]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => StorageOutcome::Ok(probe_row_from_rows(target, rows)),
        outcome => {
            outcome.map(|_| repair_probe_row(target, RepairTargetState::Unavailable, false, true))
        }
    }
}

fn probe_row_from_rows(
    target: &RepairTargetProbe,
    rows: Vec<SqlRow>,
) -> lkjstr_storage::RepairScanRow {
    let Some(row) = rows.into_iter().next() else {
        return repair_probe_row(target, RepairTargetState::Missing, true, false);
    };
    match serde_json::to_value(row).and_then(serde_json::from_value::<RepairProbeHit>) {
        Ok(hit) if hit.probe_present > 0 => {
            repair_probe_row(target, RepairTargetState::Present, true, false)
        }
        Ok(_) => repair_probe_row(target, RepairTargetState::Missing, true, false),
        Err(_) => repair_probe_row(target, RepairTargetState::Unavailable, false, true),
    }
}

fn empty_backfill_output() -> RepairBackfillOutput {
    RepairBackfillOutput {
        findings: Vec::new(),
        planned_count: 0,
        applied_count: 0,
        skipped_count: 0,
    }
}

fn empty_probe_output() -> RepairTargetProbeOutput {
    RepairTargetProbeOutput {
        findings: Vec::new(),
        rows: Vec::new(),
        scanned_count: 0,
        next_cursor: None,
        chunk_continues: false,
    }
}
