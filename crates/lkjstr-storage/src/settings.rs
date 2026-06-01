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

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteSettingRow {
    pub key: String,
    pub value_json: String,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn setting_record_key(row: &SettingOverrideRecord) -> &str {
    &row.key
}

#[must_use]
pub fn setting_namespace(key: &str) -> String {
    key.split_once('.')
        .map_or("debug", |(prefix, _)| prefix)
        .to_owned()
}

pub fn setting_record_json_bytes(row: &SettingOverrideRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_setting_row(
    row: &SettingOverrideRecord,
) -> Result<SqliteSettingRow, serde_json::Error> {
    Ok(SqliteSettingRow {
        key: row.key.clone(),
        value_json: serde_json::to_string(&row.value)?,
        updated_at_ms: row.updated_at,
    })
}

pub fn setting_from_sqlite_row(
    row: &SqliteSettingRow,
) -> Result<SettingOverrideRecord, serde_json::Error> {
    Ok(SettingOverrideRecord {
        key: row.key.clone(),
        namespace: setting_namespace(&row.key),
        value: serde_json::from_str(&row.value_json)?,
        updated_at: row.updated_at_ms,
    })
}
