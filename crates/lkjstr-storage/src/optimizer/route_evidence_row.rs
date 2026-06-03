use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct RouteEvidenceScoreRecord {
    pub author_pubkey: String,
    pub relay_url: String,
    pub surface: String,
    pub source: String,
    pub source_confidence: f64,
    pub measured_success: u64,
    pub measured_failure: u64,
    pub last_success_at_ms: Option<u64>,
    pub last_failure_at_ms: Option<u64>,
    pub updated_at_ms: u64,
}

pub type SqliteRouteEvidenceScoreRow = RouteEvidenceScoreRecord;

#[must_use]
pub fn sqlite_route_evidence_score_row(
    record: &RouteEvidenceScoreRecord,
) -> SqliteRouteEvidenceScoreRow {
    record.clone()
}

#[must_use]
pub fn route_evidence_score_from_sqlite_row(
    row: &SqliteRouteEvidenceScoreRow,
) -> RouteEvidenceScoreRecord {
    row.clone()
}

#[must_use]
pub fn route_evidence_score_key(record: &RouteEvidenceScoreRecord) -> String {
    [
        record.author_pubkey.as_str(),
        record.relay_url.as_str(),
        record.surface.as_str(),
        record.source.as_str(),
    ]
    .join("\u{1f}")
}
