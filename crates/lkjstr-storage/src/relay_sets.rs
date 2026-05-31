#![doc = "Relay-set storage row helpers."]

use lkjstr_domain::RelaySet;

pub type RelaySetRecord = RelaySet;

#[must_use]
pub fn relay_set_record_id(row: &RelaySetRecord) -> &str {
    &row.id
}

pub fn relay_set_record_json_bytes(row: &RelaySetRecord) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}
