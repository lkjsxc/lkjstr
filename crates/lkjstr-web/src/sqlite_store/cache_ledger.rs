#![doc = "SQLite cache-ledger statement helpers."]

use lkjstr_storage::{CacheLedgerRecord, SqliteCacheLedgerRow, StorageOutcome};

use crate::{
    sqlite_store::{
        SqliteStore,
        params::{integer, opt_text, params, raw_integer, text},
    },
    storage_worker::{SqlParams, SqlStep},
};

pub fn ledger_step(
    store: &SqliteStore,
    ledger: &CacheLedgerRecord,
    table_name: &'static str,
) -> StorageOutcome<SqlStep> {
    store.step(
        "cache_ledger.upsert",
        ledger_params(lkjstr_storage::sqlite_cache_ledger_row_for_table(
            ledger, table_name,
        )),
    )
}

pub fn ledger_params(row: SqliteCacheLedgerRow) -> Option<SqlParams> {
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
