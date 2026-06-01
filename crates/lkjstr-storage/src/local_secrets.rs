#![doc = "Local account secret storage row helpers."]

use lkjstr_domain::LocalAccountSecret;
use serde::{Deserialize, Serialize};

pub type LocalAccountSecretRecord = LocalAccountSecret;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteLocalSecretRow {
    pub pubkey: String,
    pub secret_payload: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn local_secret_record_key(row: &LocalAccountSecretRecord) -> &str {
    &row.account_id
}

#[must_use]
pub fn local_secret_sqlite_key(key: &str) -> String {
    crate::accounts::account_sqlite_key(key)
}

pub fn local_secret_record_json_bytes(
    row: &LocalAccountSecretRecord,
) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_local_secret_row(
    row: &LocalAccountSecretRecord,
) -> Result<SqliteLocalSecretRow, serde_json::Error> {
    Ok(SqliteLocalSecretRow {
        pubkey: row.pubkey.clone(),
        secret_payload: serde_json::to_string(row)?,
        created_at_ms: row.created_at,
        updated_at_ms: row.updated_at,
    })
}

pub fn local_secret_from_sqlite_row(
    row: &SqliteLocalSecretRow,
) -> Result<LocalAccountSecretRecord, serde_json::Error> {
    serde_json::from_str(&row.secret_payload)
}
