#![doc = "SQLite job repository calls."]

use lkjstr_storage::{JobRecord, SqliteJobRow, StorageOperation, StorageOutcome};

use crate::sqlite_store::{
    cache_ledger::ledger_step,
    database::SqliteStore,
    diagnostic_params::job_params,
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

pub async fn sqlite_job_put(store: &SqliteStore, row: &JobRecord) -> StorageOutcome<()> {
    let ledger = match lkjstr_storage::job_ledger_record(row) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
    };
    let mut steps = Vec::with_capacity(2);
    add_step!(
        &mut steps,
        store.step("jobs.upsert", job_params(row.clone()))
    );
    add_step!(&mut steps, ledger_step(store, &ledger, "jobs"));
    store.batch(steps).await
}

pub async fn sqlite_job_get(
    store: &SqliteStore,
    job_id: &str,
) -> StorageOutcome<Option<JobRecord>> {
    let rows = match store
        .query("jobs.select", params(vec![text(job_id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row::<SqliteJobRow>(rows, "jobs", "jobs.select")
}

pub async fn sqlite_jobs_recent(store: &SqliteStore, limit: u64) -> StorageOutcome<Vec<JobRecord>> {
    let rows = match store
        .query("jobs.recent", params(vec![integer(limit)]), limit as u32)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows::<SqliteJobRow>(rows, "jobs", "jobs.recent")
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "jobs",
        "corrupt",
        operation_id,
    ))
}
