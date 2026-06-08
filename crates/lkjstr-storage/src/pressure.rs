#![doc = "Storage pressure snapshot row helpers."]

use serde::{Deserialize, Serialize};

use crate::StorageProblemKind;

pub const STORAGE_PRESSURE_META_KEY: &str = "storage.pressure.latest";

pub const PRESSURE_STOP_REASONS: &[&str] = &[
    "below-target",
    "target-met",
    "no-prunable-candidates",
    "protected-only",
    "unknown-unowned-usage",
    "inventory-incomplete",
    "quota-pressure",
    "storage-api-unavailable",
    "compaction-error",
    "deadline",
];

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StoragePressureSnapshotRecord {
    pub target_bytes: u64,
    pub usage_bytes: Option<u64>,
    pub protected_bytes: u64,
    pub prunable_bytes: u64,
    pub unknown_bytes: u64,
    pub residual_overhead_bytes: u64,
    pub pruned_bytes: u64,
    pub pruned_resource_count: u64,
    pub stop_reason: String,
    pub checked_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SqliteStoragePressureSnapshotRow {
    pub key: String,
    pub value_json: String,
    pub updated_at_ms: u64,
}

#[must_use]
pub const fn storage_pressure_meta_key() -> &'static str {
    STORAGE_PRESSURE_META_KEY
}

#[must_use]
pub fn pressure_stop_reason_is_known(reason: &str) -> bool {
    PRESSURE_STOP_REASONS.contains(&reason)
}

#[must_use]
pub fn pressure_problem_kind(stop_reason: &str) -> Option<StorageProblemKind> {
    match stop_reason {
        "no-prunable-candidates" => Some(StorageProblemKind::PressureNoPrunableCandidates),
        "protected-only" => Some(StorageProblemKind::PressureProtectedOnly),
        "unknown-unowned-usage" => Some(StorageProblemKind::PressureUnknownUsage),
        "inventory-incomplete" => Some(StorageProblemKind::PressureInventoryIncomplete),
        "quota-pressure" => Some(StorageProblemKind::PressureQuota),
        "storage-api-unavailable" => Some(StorageProblemKind::PressureStorageApiUnavailable),
        "compaction-error" => Some(StorageProblemKind::PressureCompactionError),
        "deadline" => Some(StorageProblemKind::PressureDeadline),
        _ => None,
    }
}

pub fn storage_pressure_json_bytes(
    row: &StoragePressureSnapshotRecord,
) -> Result<usize, serde_json::Error> {
    serde_json::to_vec(row).map(|bytes| bytes.len())
}

pub fn sqlite_storage_pressure_snapshot_row(
    row: &StoragePressureSnapshotRecord,
) -> Result<SqliteStoragePressureSnapshotRow, serde_json::Error> {
    Ok(SqliteStoragePressureSnapshotRow {
        key: STORAGE_PRESSURE_META_KEY.to_owned(),
        value_json: serde_json::to_string(row)?,
        updated_at_ms: row.checked_at_ms,
    })
}

pub fn storage_pressure_from_sqlite_row(
    row: &SqliteStoragePressureSnapshotRow,
) -> Result<StoragePressureSnapshotRecord, serde_json::Error> {
    serde_json::from_str(&row.value_json)
}
