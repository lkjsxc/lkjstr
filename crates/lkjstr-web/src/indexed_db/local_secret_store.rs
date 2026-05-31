use lkjstr_storage::{LocalAccountSecretRecord, StorageOutcome, local_secret_record_key};

use crate::indexed_db::database::{DEFAULT_DB_NAME, LOCAL_ACCOUNT_SECRETS_TABLE};
use crate::indexed_db::{record_requests, record_write};

pub async fn default_local_secret_get(
    account_id: &str,
) -> StorageOutcome<Option<LocalAccountSecretRecord>> {
    local_secret_get(DEFAULT_DB_NAME, account_id).await
}

pub async fn local_secret_put(db_name: &str, row: &LocalAccountSecretRecord) -> StorageOutcome<()> {
    record_write::put(
        db_name,
        LOCAL_ACCOUNT_SECRETS_TABLE,
        local_secret_record_key(row),
        row,
    )
    .await
}

pub async fn local_secret_get(
    db_name: &str,
    account_id: &str,
) -> StorageOutcome<Option<LocalAccountSecretRecord>> {
    record_requests::get(db_name, LOCAL_ACCOUNT_SECRETS_TABLE, account_id).await
}

pub async fn local_secret_delete(db_name: &str, account_id: &str) -> StorageOutcome<()> {
    record_write::delete(db_name, LOCAL_ACCOUNT_SECRETS_TABLE, account_id).await
}
