#![doc = "SQLite retention delete dispatcher."]

use lkjstr_storage::{
    RetentionDeleteDispatchInput, RetentionDeleteDispatchOutput, RetentionDynamicProtection,
    StorageOutcome,
};

use crate::{
    retention_dispatch::{
        RetentionDispatchBatch, RetentionDispatchStep, retention_delete_dispatch_finish,
        retention_delete_dispatch_steps,
    },
    sqlite_store::{
        SqliteStore,
        params::{params, text},
    },
};

pub async fn sqlite_retention_delete_dispatch(
    store: &SqliteStore,
    input: RetentionDeleteDispatchInput,
    dynamic_protections: &[RetentionDynamicProtection],
) -> StorageOutcome<RetentionDeleteDispatchOutput> {
    let batch = match retention_delete_dispatch_steps(input, dynamic_protections) {
        StorageOutcome::Ok(batch) => batch,
        outcome => return outcome.map(|batch| batch.output),
    };
    let output = batch.output.clone();
    if batch.steps.is_empty() {
        return StorageOutcome::Ok(output);
    }
    let mut steps = Vec::with_capacity(batch.steps.len());
    for spec in batch.steps {
        match store.step(spec.statement_id, params(vec![text(spec.resource_id)])) {
            StorageOutcome::Ok(step) => steps.push(step),
            outcome => return outcome.map(|_| output),
        }
    }
    retention_delete_dispatch_finish(store.batch(steps).await, output)
}

pub fn sqlite_retention_delete_dispatch_steps(
    input: RetentionDeleteDispatchInput,
    dynamic_protections: &[RetentionDynamicProtection],
) -> StorageOutcome<RetentionDispatchBatch> {
    retention_delete_dispatch_steps(input, dynamic_protections)
}

pub type SqliteRetentionDispatchBatch = RetentionDispatchBatch;
pub type SqliteRetentionDispatchStep = RetentionDispatchStep;
