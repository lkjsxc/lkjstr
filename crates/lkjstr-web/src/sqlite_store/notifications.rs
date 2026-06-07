#![doc = "SQLite notification repository calls."]

use lkjstr_storage::{NotificationRecord, SqliteNotificationRow, StorageOperation, StorageOutcome};

use crate::{
    sqlite_store::{
        cache_ledger::ledger_step,
        database::SqliteStore,
        params::{integer, opt_text, params, text},
        rows::all_rows,
    },
    storage_worker::SqlParams,
};

macro_rules! add_step {
    ($steps:expr, $outcome:expr $(,)?) => {
        match $outcome {
            StorageOutcome::Ok(step) => $steps.push(step),
            outcome => return outcome.map(|_| ()),
        }
    };
}

pub async fn sqlite_notifications_put(
    store: &SqliteStore,
    rows: &[NotificationRecord],
) -> StorageOutcome<()> {
    let mut steps = Vec::with_capacity(rows.len() * 2);
    for row in rows {
        add_step!(
            &mut steps,
            store.step(
                "notifications.upsert",
                notification_params(lkjstr_storage::sqlite_notification_row(row)),
            ),
        );
        let ledger = match lkjstr_storage::notification_ledger_record(row) {
            Ok(row) => row,
            Err(_) => return corrupt("cache_ledger.upsert", StorageOperation::Write),
        };
        add_step!(&mut steps, ledger_step(store, &ledger, "notifications"));
    }
    store.batch(steps).await
}

pub async fn sqlite_notifications_for_owner(
    store: &SqliteStore,
    owner_pubkey: &str,
    before_created_at: u64,
    limit: u64,
) -> StorageOutcome<Vec<NotificationRecord>> {
    let rows = match store
        .query(
            "notifications.by_owner",
            params(vec![
                text(owner_pubkey),
                integer(before_created_at),
                integer(limit),
            ]),
            limit as u32,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(rows, "notifications", "notifications.by_owner")
}

fn notification_params(row: SqliteNotificationRow) -> Option<SqlParams> {
    params(vec![
        text(row.notification_id),
        text(row.owner_pubkey),
        text(row.source_event_id),
        opt_text(row.target_event_id),
        opt_text(row.root_event_id),
        text(row.actor_pubkey),
        text(row.notification_kind),
        integer(row.created_at),
        integer(row.updated_at_ms),
    ])
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "notifications",
        "corrupt",
        operation_id,
    ))
}
