#![doc = "SQLite account repository calls."]

use lkjstr_domain::normalize_account;
use lkjstr_storage::{
    AccountRecord, LocalAccountSecretRecord, SqliteAccountRow, SqliteLocalSecretRow,
    StorageOutcome, account_from_sqlite_row, account_sqlite_key, local_secret_from_sqlite_row,
    local_secret_sqlite_key, sqlite_account_row, sqlite_local_secret_row,
};

use crate::sqlite_store::{
    database::SqliteStore,
    params::{integer, no_params, params, text},
    rows::{all_rows, first_row},
};

pub async fn sqlite_account_put(store: &SqliteStore, row: &AccountRecord) -> StorageOutcome<()> {
    let row = match sqlite_account_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("accounts.upsert"),
    };
    store.execute("accounts.upsert", account_params(row)).await
}

pub async fn sqlite_local_account_put(
    store: &SqliteStore,
    account: &AccountRecord,
    secret: &LocalAccountSecretRecord,
) -> StorageOutcome<()> {
    let account = match sqlite_account_row(account) {
        Ok(row) => row,
        Err(_) => return corrupt("accounts.upsert"),
    };
    let secret = match sqlite_local_secret_row(secret) {
        Ok(row) => row,
        Err(_) => return corrupt("local_account_secrets.upsert"),
    };
    let account = match store.step("accounts.upsert", account_params(account)) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    let secret = match store.step("local_account_secrets.upsert", secret_params(secret)) {
        StorageOutcome::Ok(step) => step,
        outcome => return outcome.map(|_| ()),
    };
    store.batch(vec![account, secret]).await
}

pub async fn sqlite_account_delete(store: &SqliteStore, id: &str) -> StorageOutcome<()> {
    store
        .execute(
            "accounts.delete",
            params(vec![text(account_sqlite_key(id))]),
        )
        .await
}

pub async fn sqlite_account_get(
    store: &SqliteStore,
    id: &str,
) -> StorageOutcome<Option<AccountRecord>> {
    let rows = match store
        .query(
            "accounts.select",
            params(vec![text(account_sqlite_key(id))]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteAccountRow>(rows, "accounts", "accounts.select") {
        StorageOutcome::Ok(Some(row)) => match account_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(normalize_account(&row))),
            Err(_) => corrupt("accounts.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_accounts_all(store: &SqliteStore) -> StorageOutcome<Vec<AccountRecord>> {
    let rows = match store.query("accounts.all", no_params(), 1_000).await {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let sqlite_rows = match all_rows::<SqliteAccountRow>(rows, "accounts", "accounts.all") {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| Vec::new()),
    };
    let mut out = Vec::with_capacity(sqlite_rows.len());
    for row in sqlite_rows {
        match account_from_sqlite_row(&row) {
            Ok(row) => out.push(normalize_account(&row)),
            Err(_) => return corrupt("accounts.all"),
        }
    }
    out.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.id.cmp(&left.id))
    });
    StorageOutcome::Ok(out)
}

pub async fn sqlite_local_secret_put(
    store: &SqliteStore,
    row: &LocalAccountSecretRecord,
) -> StorageOutcome<()> {
    let row = match sqlite_local_secret_row(row) {
        Ok(row) => row,
        Err(_) => return corrupt("local_account_secrets.upsert"),
    };
    store
        .execute("local_account_secrets.upsert", secret_params(row))
        .await
}

pub async fn sqlite_local_secret_get(
    store: &SqliteStore,
    account_id: &str,
) -> StorageOutcome<Option<LocalAccountSecretRecord>> {
    let rows = match store
        .query(
            "local_account_secrets.select",
            params(vec![text(local_secret_sqlite_key(account_id))]),
            1,
        )
        .await
    {
        StorageOutcome::Ok(rows) => rows,
        outcome => return outcome.map(|_| None),
    };
    match first_row::<SqliteLocalSecretRow>(rows, "local_account_secrets", "secrets.select") {
        StorageOutcome::Ok(Some(row)) => match local_secret_from_sqlite_row(&row) {
            Ok(row) => StorageOutcome::Ok(Some(row)),
            Err(_) => corrupt("local_account_secrets.select"),
        },
        outcome => outcome.map(|row| row.and(None)),
    }
}

pub async fn sqlite_local_secret_delete(
    store: &SqliteStore,
    account_id: &str,
) -> StorageOutcome<()> {
    store
        .execute(
            "local_account_secrets.delete",
            params(vec![text(local_secret_sqlite_key(account_id))]),
        )
        .await
}

fn account_params(row: SqliteAccountRow) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(row.pubkey),
        text(row.label),
        text(row.signer_kind),
        integer(row.created_at_ms),
        integer(row.updated_at_ms),
        text(row.metadata_json),
    ])
}

fn secret_params(row: SqliteLocalSecretRow) -> Option<crate::storage_worker::SqlParams> {
    params(vec![
        text(row.pubkey),
        text(row.secret_payload),
        integer(row.created_at_ms),
        integer(row.updated_at_ms),
    ])
}

fn corrupt<T>(operation_id: &'static str) -> StorageOutcome<T> {
    StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
        lkjstr_storage::StorageOperation::Read,
        "accounts",
        "corrupt",
        operation_id,
    ))
}
