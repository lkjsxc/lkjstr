#![doc = "Rust Stats storage action host callbacks."]

use lkjstr_storage::{
    RepairInventoryReportInput, RepairInventoryReportOutput, StorageOutcome,
    StorageStatsSnapshot,
    stats::{RetentionInventoryReadiness, classify_inventory_for_retention},
};
use lkjstr_ui::{StatsActionCommand, StatsActionKind, StatsActionResult, StatsActions};

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_repair_inventory_report, sqlite_storage_stats_snapshot},
};

pub fn stats_actions_provider(db_name: String, worker_url: String) -> StatsActions {
    StatsActions::new_with_unavailable_reasons(
        move |command| {
            let db_name = db_name.clone();
            let worker_url = worker_url.clone();
            wasm_bindgen_futures::spawn_local(async move {
                run_action(command, db_name, worker_url).await;
            });
        },
        false,
        true,
        "compaction-adapter-missing",
        "action-not-provided",
    )
}

async fn run_action(command: StatsActionCommand, db_name: String, worker_url: String) {
    match command {
        StatsActionCommand::Repair(complete) => {
            complete.complete(repair_report_result(&db_name, &worker_url).await);
        }
        StatsActionCommand::Compact(complete) => {
            complete.complete(StatsActionResult::unavailable(
                StatsActionKind::Compact,
                "compaction-adapter-missing",
            ));
        }
    }
}

async fn repair_report_result(db_name: &str, worker_url: &str) -> StatsActionResult {
    let outcome = with_sqlite_store(db_name, worker_url, |store| async move {
        let snapshot = sqlite_storage_stats_snapshot(&store).await;
        sqlite_repair_inventory_report(&store, repair_input(&snapshot)).await
    })
    .await;
    match outcome {
        StorageOutcome::Ok(report) => {
            StatsActionResult::new(StatsActionKind::Repair, repair_report_text(&report))
        }
        outcome => StatsActionResult::unavailable(
            StatsActionKind::Repair,
            outcome_reason(outcome).as_str(),
        ),
    }
}

fn repair_input(snapshot: &StorageStatsSnapshot) -> RepairInventoryReportInput {
    let readiness = classify_inventory_for_retention(snapshot);
    RepairInventoryReportInput {
        inventory_complete: inventory_complete(&readiness),
        temporary_memory_mode: readiness.storage_mode == "temporary-memory",
        table_count: snapshot.table_count,
        next_cursor: None,
    }
}

fn inventory_complete(readiness: &RetentionInventoryReadiness) -> bool {
    readiness.blocking_reason.as_deref() != Some("inventory-incomplete")
}

fn repair_report_text(report: &RepairInventoryReportOutput) -> String {
    match report.findings.len() {
        0 => format!(
            "Repair report complete: no findings across {} tables",
            report.table_count
        ),
        1 => format!(
            "Repair report complete: 1 finding across {} tables",
            report.table_count
        ),
        count => format!(
            "Repair report complete: {count} findings across {} tables",
            report.table_count
        ),
    }
}

fn outcome_reason<T>(outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || "unavailable".to_string(),
        |problem| problem.reason.to_string(),
    )
}
