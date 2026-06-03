use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct RelayReadScoreRecord {
    pub relay_url: String,
    pub surface: String,
    pub phase: String,
    pub direction: String,
    pub route_group_key: String,
    pub filter_shape: String,
    pub purpose: String,
    pub reliability: f64,
    pub first_event_speed: f64,
    pub eose_speed: f64,
    pub useful_yield: f64,
    pub unique_yield: f64,
    pub penalty: f64,
    pub fairness_credit: f64,
    pub sample_count: u64,
    pub updated_at_ms: u64,
}

pub type SqliteRelayReadScoreRow = RelayReadScoreRecord;

#[must_use]
pub fn sqlite_relay_read_score_row(record: &RelayReadScoreRecord) -> SqliteRelayReadScoreRow {
    record.clone()
}

#[must_use]
pub fn relay_read_score_from_sqlite_row(row: &SqliteRelayReadScoreRow) -> RelayReadScoreRecord {
    row.clone()
}

#[must_use]
pub fn relay_read_score_key(record: &RelayReadScoreRecord) -> String {
    [
        record.relay_url.as_str(),
        record.surface.as_str(),
        record.phase.as_str(),
        record.direction.as_str(),
        record.route_group_key.as_str(),
        record.filter_shape.as_str(),
        record.purpose.as_str(),
    ]
    .join("\u{1f}")
}
