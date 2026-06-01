#![doc = "SQLite relay-set repository calls."]

use lkjstr_domain::sorted_relay_sets;
use lkjstr_storage::{
    RelaySetRecord, SqliteRelaySetRow, StorageOutcome, relay_set_from_sqlite_row,
    sqlite_relay_set_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, no_params, params, raw_integer, text},
    rows::{all_rows, first_row},
};

pub async fn sqlite_relay_set_put(store: &SqliteStore, row: &RelaySetRecord) -> StorageOutcome<()> {
    let row = match sqlite_relay_set_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("relay_sets.upsert"),
    };
    store
        .execute(
            "relay_sets.upsert",
            params(vec![
                text(row.set_id),
                text(row.name),
                text(row.relays_json),
                raw_integer(row.selected_read),
                raw_integer(row.selected_write),
                integer(row.updated_at_ms),
            ]),
        )
        .await
}

pub async fn sqlite_relay_set_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<RelaySetRecord>> {
    let rows = match store
        .query("relay_sets.select", params(vec![text(id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteRelaySetRow>(rows, "relay_sets", "relay_sets.select") {
        StorageOutcome::Ok(Some(row)) => match relay_set_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("relay_sets.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_relay_sets_all(store: &SqliteStore) -> StorageOutcome<Vec<RelaySetRecord>> {
    let rows = match store.query("relay_sets.all", no_params(), 1_000).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows = match all_rows::<SqliteRelaySetRow>(rows, "relay_sets", "relay_sets.all") {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let mut out = Vec::with_capacity(sqlite_rows.len());
    for row in sqlite_rows {
        match relay_set_from_sqlite_row(&row) {
            Ok(row) => out.push(row),
            Err(_) => return corrupt("relay_sets.all"),
        }
    }
    StorageOutcome::Ok(sorted_relay_sets(out))
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "relay_sets",
        "corrupt",
        operation_id,
    ))
}
