#![doc = "SQLite cached-event query calls."]

use lkjstr_storage::{
    SqliteEventRelayRow, SqliteEventRow, StorageOperation, StorageOutcome, StoredEventRecord,
};

use crate::{
    sqlite_store::{
        database::SqliteStore,
        params::{integer, params, text},
        rows::{all_rows, first_row},
    },
    storage_worker::SqlParams,
};

pub async fn sqlite_event_get(
    store: &SqliteStore,
    event_id: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let rows = match store
        .query("events.select", params(vec![text(event_id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteEventRow>(rows, "events", "events.select") {
        StorageOutcome::Ok(Some(row)) => lkjstr_storage::event_from_sqlite_row(&row)
            .map(Some)
            .map_or_else(
                |_| corrupt("events.select", StorageOperation::Read),
                StorageOutcome::Ok,
            ),
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_event_relays(
    store: &SqliteStore,
    event_id: &str,
) -> StorageOutcome<Vec<SqliteEventRelayRow>> {
    let rows = match store
        .query("event_relays.by_event", params(vec![text(event_id)]), 100)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    all_rows(rows, "event_relays", "event_relays.by_event")
}

pub async fn sqlite_events_by_tag_value(
    store: &SqliteStore,
    tag_name: &str,
    tag_value: &str,
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    query_events(
        store,
        "events.by_tag_value",
        params(vec![text(tag_name), text(tag_value), integer(limit)]),
        limit,
    )
    .await
}

pub async fn sqlite_events_by_kind(
    store: &SqliteStore,
    kind: u64,
    before_created_at: u64,
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    query_events(
        store,
        "events.by_kind_time",
        params(vec![
            integer(kind),
            integer(before_created_at),
            integer(limit),
        ]),
        limit,
    )
    .await
}

pub async fn sqlite_events_by_author_kind(
    store: &SqliteStore,
    pubkey: &str,
    kind: u64,
    before_created_at: u64,
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    query_events(
        store,
        "events.by_pubkey_kind_time",
        params(vec![
            text(pubkey),
            integer(kind),
            integer(before_created_at),
            integer(limit),
        ]),
        limit,
    )
    .await
}

async fn query_events(
    store: &SqliteStore,
    statement: &'static str,
    sql_params: Option<SqlParams>,
    limit: u64,
) -> StorageOutcome<Vec<StoredEventRecord>> {
    let rows = match store.query(statement, sql_params, limit as u32).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows = match all_rows::<SqliteEventRow>(rows, "events", statement) {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    sqlite_rows
        .iter()
        .map(lkjstr_storage::event_from_sqlite_row)
        .collect::<Result<Vec<_>, _>>()
        .map_or_else(
            |_| corrupt(statement, StorageOperation::Read),
            StorageOutcome::Ok,
        )
}

fn corrupt<T>(operation_id: &'static str, operation: StorageOperation) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        operation,
        "events",
        "corrupt",
        operation_id,
    ))
}
