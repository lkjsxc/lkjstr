use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ScanObservationRecord {
    pub id: String,
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
    pub since_seconds: u64,
    pub until_seconds: u64,
    pub requested_limit: u16,
    pub effective_limit: u16,
    pub event_count: u16,
    pub unique_event_count: u16,
    pub final_visible_count: u16,
    pub event_limit_reached: bool,
    pub eose: bool,
    pub timeout: bool,
    pub closed: bool,
    pub auth: bool,
    pub socket_error: bool,
    pub bytes_sent: u32,
    pub bytes_received: u32,
    pub started_at_ms: u64,
    pub completed_at_ms: u64,
    pub created_at_ms: u64,
}

pub type SqliteScanObservationRow = ScanObservationRecord;

#[must_use]
pub fn sqlite_scan_observation_row(record: &ScanObservationRecord) -> SqliteScanObservationRow {
    record.clone()
}

#[must_use]
pub fn scan_observation_from_sqlite_row(row: &SqliteScanObservationRow) -> ScanObservationRecord {
    row.clone()
}
