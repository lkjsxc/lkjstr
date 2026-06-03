use serde::{Deserialize, Serialize};

use super::scan_model_key::{
    OptimizerKeyProblem, ScanModelKeyRecord, StoredScanModelScope, scan_model_storage_key,
};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ScanDensityModelRecord {
    pub model_key: String,
    pub scope: StoredScanModelScope,
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: String,
    pub route_fingerprint: String,
    pub target_limit_fraction: String,
    pub density_events_per_second: f64,
    pub log_density_mean: f64,
    pub log_density_variance: f64,
    pub sample_weight: f64,
    pub complete_window_count: u64,
    pub dense_window_count: u64,
    pub sparse_window_count: u64,
    pub incomplete_window_count: u64,
    pub failure_window_count: u64,
    pub limit_hit_rate: f64,
    pub incomplete_rate: f64,
    pub last_good_span_seconds: u64,
    pub last_proposed_span_seconds: u64,
    pub last_observed_since_seconds: u64,
    pub last_observed_until_seconds: u64,
    pub updated_at_ms: u64,
    pub decays_after_ms: u64,
}

pub type SqliteScanDensityModelRow = ScanDensityModelRecord;

#[must_use]
pub fn sqlite_scan_density_model_row(record: &ScanDensityModelRecord) -> SqliteScanDensityModelRow {
    record.clone()
}

#[must_use]
pub fn scan_density_model_from_sqlite_row(
    row: &SqliteScanDensityModelRow,
) -> ScanDensityModelRecord {
    row.clone()
}

pub fn scan_density_model_storage_key(
    record: &ScanDensityModelRecord,
) -> Result<String, OptimizerKeyProblem> {
    scan_model_storage_key(&ScanModelKeyRecord {
        scope: record.scope.clone(),
        semantic_feed_key: record.semantic_feed_key.clone(),
        route_group_key: record.route_group_key.clone(),
        relay_url: record.relay_url.clone(),
        semantic_filter_key: record.semantic_filter_key.clone(),
        direction: record.direction.clone(),
        route_fingerprint: record.route_fingerprint.clone(),
    })
}
