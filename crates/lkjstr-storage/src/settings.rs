#![doc = "Settings storage row helpers."]

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingOverrideRecord {
    pub key: String,
    pub namespace: String,
    pub value: Value,
    pub updated_at: u64,
}

#[must_use]
pub fn setting_record_key(row: &SettingOverrideRecord) -> &str {
    &row.key
}

pub fn setting_record_json_bytes(row: &SettingOverrideRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
