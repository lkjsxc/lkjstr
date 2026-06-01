#![doc = "SQLite relay diagnostics repository calls."]

use lkjstr_storage::{
    RelayDiagnosticSummaryRecord, RelayInformationRecord, SqliteRelayDiagnosticSummaryRow,
    SqliteRelayInformationRow, StorageOperation, StorageOutcome,
};

use crate::sqlite_store::{
    cache_ledger::ledger_step,
    database::SqliteStore,
    diagnostic_params::{relay_info_params, relay_summary_params},
    params::{integer, params, text},
    rows::{all_rows, first_row},
};

macro_rules! add_step {
    ($steps:expr, $outcome:expr $(,)?) => {
        match $outcome {
            StorageOutcome::Ok(step) => $steps.push(step),
            outcome => return outcome.map(|_| ()),
        }
    };
}

pub async fn sqlite_relay_information_put(
    store: &SqliteStore,
    row: &RelayInformationRecord,
) -> StorageOutcome<()> {
    let ledger = match lkjstr_storage::relay_info_ledger_record(row) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
    };
    let mut steps = Vec::with_capacity(2);
    add_step!(
        &mut steps,
        store.step("relay_information.upsert", relay_info_params(row.clone())),
    );
    add_step!(&mut steps, ledger_step(store, &ledger, "relay_information"));
    store.batch(steps).await
}

pub async fn sqlite_relay_information_get(
    store: &SqliteStore,
    relay_url: &str,
) -> StorageOutcome<Option<RelayInformationRecord>> {
    let rows = match store
        .query("relay_information.select", params(vec![text(relay_url)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row::<SqliteRelayInformationRow>(rows, "relay_information", "relay_information.select")
}

pub async fn sqlite_relay_information_recent(
    store: &SqliteStore,
    limit: u64,
) -> StorageOutcome<Vec<RelayInformationRecord>> {
    query_all(
        store,
        "relay_information.recent",
        limit,
        "relay_information",
    )
    .await
}

pub async fn sqlite_relay_summary_put(
    store: &SqliteStore,
    row: &RelayDiagnosticSummaryRecord,
) -> StorageOutcome<()> {
    let ledger = match lkjstr_storage::relay_summary_ledger_record(row) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
    };
    let mut steps = Vec::with_capacity(2);
    add_step!(
        &mut steps,
        store.step(
            "relay_diagnostic_summaries.upsert",
            relay_summary_params(row.clone()),
        ),
    );
    add_step!(
        &mut steps,
        ledger_step(store, &ledger, "relay_diagnostic_summaries"),
    );
    store.batch(steps).await
}

pub async fn sqlite_relay_summary_get(
    store: &SqliteStore,
    relay_url: &str,
) -> StorageOutcome<Option<RelayDiagnosticSummaryRecord>> {
    let rows = match store
        .query(
            "relay_diagnostic_summaries.select",
            params(vec![text(relay_url)]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row::<SqliteRelayDiagnosticSummaryRow>(
        rows,
        "relay_diagnostic_summaries",
        "relay_diagnostic_summaries.select",
    )
}

pub async fn sqlite_relay_summaries_recent(
    store: &SqliteStore,
    limit: u64,
) -> StorageOutcome<Vec<RelayDiagnosticSummaryRecord>> {
    let rows = match store
        .query(
            "relay_diagnostic_summaries.recent",
            params(vec![integer(limit)]),
            limit as u32,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(
        rows,
        "relay_diagnostic_summaries",
        "relay_diagnostic_summaries.recent",
    )
}

async fn query_all(
    store: &SqliteStore,
    statement: &'static str,
    limit: u64,
    table: &'static str,
) -> StorageOutcome<Vec<RelayInformationRecord>> {
    let rows = match store
        .query(statement, params(vec![integer(limit)]), limit as u32)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(rows, table, statement)
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "relay_diagnostics",
        "corrupt",
        operation_id,
    ))
}
