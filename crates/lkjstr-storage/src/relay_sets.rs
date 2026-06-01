#![doc = "Relay-set storage row helpers."]

use lkjstr_domain::RelaySet;
use serde::{Deserialize, Serialize};

pub type RelaySetRecord = RelaySet;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteRelaySetRow {
    pub set_id: String,
    pub name: String,
    pub relays_json: String,
    pub selected_read: i64,
    pub selected_write: i64,
    pub updated_at_ms: u64,
}

#[must_use]
pub fn relay_set_record_id(row: &RelaySetRecord) -> &str {
    &row.id
}

pub fn relay_set_record_json_bytes(row: &RelaySetRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_relay_set_row(row: &RelaySetRecord) -> Result<SqliteRelaySetRow, serde_json::Error> {
    let selected = i64::from(row.is_default.unwrap_or(false));
    Ok(SqliteRelaySetRow {
        set_id: row.id.clone(),
        name: row.name.clone(),
        relays_json: serde_json::to_string(row)?,
        selected_read: selected,
        selected_write: selected,
        updated_at_ms: row.updated_at,
    })
}

pub fn relay_set_from_sqlite_row(
    row: &SqliteRelaySetRow,
) -> Result<RelaySetRecord, serde_json::Error> {
    serde_json::from_str(&row.relays_json)
}
