#![doc = "Account storage row helpers."]

use lkjstr_domain::Account;

pub type AccountRecord = Account;

#[must_use]
pub fn account_record_id(row: &AccountRecord) -> &str {
    &row.id
}

pub fn account_record_json_bytes(row: &AccountRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
