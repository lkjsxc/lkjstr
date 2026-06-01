#![doc = "SQLite tab-state repository calls."]

use lkjstr_storage::{
    SqliteCacheLedgerRow, SqliteTabStateRow, StorageOutcome, TabStateRecord,
    sqlite_cache_ledger_row, sqlite_tab_state_row, tab_state_from_sqlite_row,
    tab_state_ledger_record,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, opt_text, params, raw_integer, text},
    rows::{all_rows, first_row},
};

pub async fn sqlite_tab_state_put(store: &SqliteStore, row: &TabStateRecord) -> StorageOutcome<()> {
    let tab = match sqlite_tab_state_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("tab_states.upsert"),
    };
    let ledger = match tab_state_ledger_record(row).map(|ledger| sqlite_cache_ledger_row(&ledger)) {
        Ok(row) => row,
        Err(_) => return corrupt("cache_ledger.upsert"),
    };
    let tab = match store.step("tab_states.upsert", tab_params(tab)) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    let ledger = match store.step("cache_ledger.upsert", ledger_params(ledger)) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    store.batch(vec![tab, ledger]).await
}

pub async fn sqlite_tab_state_delete(store: &SqliteStore, id: &str) -> StorageOutcome<()> {
    let (workspace_id, tab_id) = match split_tab_state_id(id) {
        StorageOutcome::Ok(ids) => ids,
        outcome => return outcome.map(|_| ()),
    };
    let tab = match store.step(
        "tab_states.delete",
        params(vec![text(workspace_id), text(tab_id)]),
    ) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    let ledger = match store.step("cache_ledger.delete", params(vec![text(id)])) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    store.batch(vec![tab, ledger]).await
}

pub async fn sqlite_tab_state_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<TabStateRecord>> {
    let (workspace_id, tab_id) = match split_tab_state_id(id) {
        StorageOutcome::Ok(ids) => ids,
        outcome => return outcome.map(|_| None),
    };
    let rows = match store
        .query(
            "tab_states.select",
            params(vec![text(workspace_id), text(tab_id)]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteTabStateRow>(rows, "tab_states", "tab_states.select") {
        StorageOutcome::Ok(Some(row)) => match tab_state_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("tab_states.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_tab_states_for_workspace(
    store: &SqliteStore,
    workspace_id: &str,
) -> StorageOutcome<Vec<TabStateRecord>> {
    let rows = match store
        .query(
            "tab_states.by_workspace",
            params(vec![text(workspace_id)]),
            500,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows =
        match all_rows::<SqliteTabStateRow>(rows, "tab_states", "tab_states.by_workspace") {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| Vec::new()),
        };
    let mut out = Vec::with_capacity(sqlite_rows.len());
    for row in sqlite_rows {
        match tab_state_from_sqlite_row(&row) {
            Ok(row) => out.push(row),
            Err(_) => return corrupt("tab_states.by_workspace"),
        }
    }
    StorageOutcome::Ok(out)
}

pub async fn sqlite_tab_state_ledger_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<SqliteCacheLedgerRow>> {
    let rows = match store
        .query("cache_ledger.select", params(vec![text(id)]), 1)
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    first_row(rows, "cache_ledger", "cache_ledger.select")
}

fn split_tab_state_id(id: &str) -> StorageOutcome<(String, String)> {
    id.split_once(':').map_or_else(
        || corrupt("tab_states.key"),
        |(workspace_id, tab_id)| StorageOutcome::Ok((workspace_id.to_owned(), tab_id.to_owned())),
    )
}

fn tab_params(row: SqliteTabStateRow) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(row.workspace_id),
        text(row.tab_id),
        text(row.tab_kind),
        text(row.snapshot_json),
        opt_text(row.scroll_anchor_json),
        integer(row.updated_at_ms),
        row.stale_after_ms
            .map_or(crate::storage_worker::SqlScalar::Null, integer),
    ])
}

fn ledger_params(row: SqliteCacheLedgerRow) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(row.resource_id),
        text(row.resource_kind),
        text(row.table_name),
        integer(row.byte_count),
        raw_integer(row.protected),
        raw_integer(row.score),
        opt_text(row.owner_key),
        integer(row.created_at_ms),
        integer(row.updated_at_ms),
    ])
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "tab_states",
        "corrupt",
        operation_id,
    ))
}
