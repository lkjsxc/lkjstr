use serde::{Deserialize, Serialize};

use super::scan_model_key::StoredScanModelScope;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ScanDecisionTraceRecord {
    pub trace_id: String,
    pub model_key: String,
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
    pub source_scope: StoredScanModelScope,
    pub confidence: f64,
    pub target_count: u16,
    pub effective_limit: u16,
    pub density_events_per_second: f64,
    pub previous_span_seconds: u64,
    pub proposed_span_seconds: u64,
    pub cap_reason: Option<String>,
    pub diagnostics_json: String,
    pub created_at_ms: u64,
}

pub type SqliteScanDecisionTraceRow = ScanDecisionTraceRecord;

#[must_use]
pub fn sqlite_scan_decision_trace_row(
    record: &ScanDecisionTraceRecord,
) -> SqliteScanDecisionTraceRow {
    record.clone()
}

#[must_use]
pub fn scan_decision_trace_from_sqlite_row(
    row: &SqliteScanDecisionTraceRow,
) -> ScanDecisionTraceRecord {
    row.clone()
}
