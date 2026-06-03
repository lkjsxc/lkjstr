use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OptimizerKeyProblem {
    TransientOwnerKey,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct OptimizerScanHintRecord {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
    pub current_span_seconds: u64,
    pub next_span_seconds: u64,
    pub min_span_seconds: u64,
    pub max_span_seconds: u64,
    pub last_feedback: String,
    pub density_ewma: f64,
    pub complete_window_count: u64,
    pub dense_window_count: u64,
    pub incomplete_window_count: u64,
    pub last_since: u64,
    pub last_until: u64,
    pub updated_at_ms: u64,
    pub expires_at_ms: u64,
}

pub type SqliteOptimizerScanHintRow = OptimizerScanHintRecord;

#[must_use]
pub fn sqlite_optimizer_scan_hint_row(
    record: &OptimizerScanHintRecord,
) -> SqliteOptimizerScanHintRow {
    record.clone()
}

#[must_use]
pub fn optimizer_scan_hint_from_sqlite_row(
    row: &SqliteOptimizerScanHintRow,
) -> OptimizerScanHintRecord {
    row.clone()
}

pub fn optimizer_scan_hint_key(
    record: &OptimizerScanHintRecord,
) -> Result<String, OptimizerKeyProblem> {
    let parts = [
        record.semantic_feed_key.as_str(),
        record.route_group_key.as_str(),
        record.relay_url.as_str(),
        record.semantic_filter_key.as_str(),
        record.direction.as_str(),
        record.route_fingerprint.as_str(),
    ];
    if parts.iter().any(|part| contains_transient_owner_key(part)) {
        Err(OptimizerKeyProblem::TransientOwnerKey)
    } else {
        Ok(parts.join("\u{1f}"))
    }
}

fn contains_transient_owner_key(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("tab_id=")
        || lower.contains("tabid=")
        || lower.contains("tab:")
        || lower.contains("pane_id=")
        || lower.contains("paneid=")
        || lower.contains("pane:")
}
