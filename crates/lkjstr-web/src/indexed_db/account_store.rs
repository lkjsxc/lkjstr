use lkjstr_domain::normalize_account;
use lkjstr_storage::{AccountRecord, StorageOutcome, account_record_id};

use crate::indexed_db::database::{ACCOUNTS_TABLE, DEFAULT_DB_NAME};
use crate::indexed_db::{record_requests, record_write};

pub async fn default_accounts_all() -> StorageOutcome<Vec<AccountRecord>> {
    accounts_all(DEFAULT_DB_NAME).await
}

pub async fn account_put(db_name: &str, row: &AccountRecord) -> StorageOutcome<()> {
    record_write::put(db_name, ACCOUNTS_TABLE, account_record_id(row), row).await
}

pub async fn account_delete(db_name: &str, id: &str) -> StorageOutcome<()> {
    record_write::delete(db_name, ACCOUNTS_TABLE, id).await
}

pub async fn account_get(db_name: &str, id: &str) -> StorageOutcome<Option<AccountRecord>> {
    record_requests::get(db_name, ACCOUNTS_TABLE, id).await
}

pub async fn accounts_all(db_name: &str) -> StorageOutcome<Vec<AccountRecord>> {
    let values =
        match record_requests::all_values(db_name, ACCOUNTS_TABLE, "accounts-all".to_owned()).await
        {
            StorageOutcome::Ok(values) => values,
            outcome => return outcome.map(|_| Vec::new()),
        };
    let mut rows = values
        .into_iter()
        .filter_map(|value| serde_wasm_bindgen::from_value::<AccountRecord>(value).ok())
        .map(|row| normalize_account(&row))
        .collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.id.cmp(&left.id))
    });
    StorageOutcome::Ok(rows)
}
