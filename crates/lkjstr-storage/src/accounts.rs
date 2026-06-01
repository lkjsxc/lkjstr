#![doc = "Account storage row helpers."]

use lkjstr_domain::{Account, SignerType};
use serde::{Deserialize, Serialize};

pub type AccountRecord = Account;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteAccountRow {
    pub pubkey: String,
    pub label: String,
    pub signer_kind: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub metadata_json: String,
}

#[must_use]
pub fn account_record_id(row: &AccountRecord) -> &str {
    &row.id
}

#[must_use]
pub fn account_sqlite_key(key: &str) -> String {
    key.split_once(':')
        .filter(|(prefix, _)| matches!(*prefix, "local" | "nip07" | "readonly"))
        .map_or_else(|| key.to_owned(), |(_, pubkey)| pubkey.to_owned())
}

#[must_use]
pub const fn signer_kind(signer_type: SignerType) -> &'static str {
    match signer_type {
        SignerType::Local => "local",
        SignerType::Nip07 => "nip07",
        SignerType::Readonly => "readonly",
    }
}

pub fn account_record_json_bytes(row: &AccountRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_account_row(row: &AccountRecord) -> Result<SqliteAccountRow, serde_json::Error> {
    Ok(SqliteAccountRow {
        pubkey: row.pubkey.clone(),
        label: row.label.clone(),
        signer_kind: signer_kind(row.signer_type).to_owned(),
        created_at_ms: row.created_at,
        updated_at_ms: row.updated_at,
        metadata_json: serde_json::to_string(row)?,
    })
}

pub fn account_from_sqlite_row(row: &SqliteAccountRow) -> Result<AccountRecord, serde_json::Error> {
    serde_json::from_str(&row.metadata_json)
}
