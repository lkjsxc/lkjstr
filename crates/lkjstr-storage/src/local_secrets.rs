#![doc = "Local account secret storage row helpers."]

use lkjstr_domain::LocalAccountSecret;

pub type LocalAccountSecretRecord = LocalAccountSecret;

#[must_use]
pub fn local_secret_record_key(row: &LocalAccountSecretRecord) -> &str {
    &row.account_id
}

pub fn local_secret_record_json_bytes(
    row: &LocalAccountSecretRecord,
) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
