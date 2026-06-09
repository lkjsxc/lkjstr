#![doc = "Stats byte rows derived from pressure snapshots."]

use serde::{Deserialize, Serialize};

use crate::pressure::StoragePressureSnapshotRecord;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct StorageByteInventoryRow {
    pub key: String,
    pub label: String,
    pub group: String,
    pub status: String,
    pub bytes: Option<u64>,
    pub problem_reason: Option<String>,
}

pub(super) fn pressure_byte_rows(
    snapshot: Option<&StoragePressureSnapshotRecord>,
    problem_reason: Option<&str>,
) -> Vec<StorageByteInventoryRow> {
    match snapshot {
        Some(snapshot) => exact_rows(snapshot),
        None => unavailable_rows(problem_reason.unwrap_or("not-recorded")),
    }
}

fn exact_rows(snapshot: &StoragePressureSnapshotRecord) -> Vec<StorageByteInventoryRow> {
    vec![
        usage_row(snapshot),
        exact("site-target", "Site target", "quota", snapshot.target_bytes),
        exact(
            "protected",
            "Protected bytes",
            "protected",
            snapshot.protected_bytes,
        ),
        exact(
            "prunable",
            "Prunable bytes",
            "prunable-cache",
            snapshot.prunable_bytes,
        ),
        exact(
            "unknown-unowned",
            "Unknown or unowned bytes",
            "unknown",
            snapshot.unknown_bytes,
        ),
        exact(
            "residual-browser-overhead",
            "Residual browser overhead",
            "overhead",
            snapshot.residual_overhead_bytes,
        ),
    ]
}

fn unavailable_rows(reason: &str) -> Vec<StorageByteInventoryRow> {
    [
        ("browser-usage", "Browser usage", "quota"),
        ("site-target", "Site target", "quota"),
        ("protected", "Protected bytes", "protected"),
        ("prunable", "Prunable bytes", "prunable-cache"),
        ("unknown-unowned", "Unknown or unowned bytes", "unknown"),
        (
            "residual-browser-overhead",
            "Residual browser overhead",
            "overhead",
        ),
    ]
    .into_iter()
    .map(|(key, label, group)| unavailable(key, label, group, reason))
    .collect()
}

fn usage_row(snapshot: &StoragePressureSnapshotRecord) -> StorageByteInventoryRow {
    snapshot.usage_bytes.map_or_else(
        || {
            unavailable(
                "browser-usage",
                "Browser usage",
                "quota",
                "usage-not-reported",
            )
        },
        |bytes| exact("browser-usage", "Browser usage", "quota", bytes),
    )
}

fn exact(key: &str, label: &str, group: &str, bytes: u64) -> StorageByteInventoryRow {
    StorageByteInventoryRow {
        key: key.to_string(),
        label: label.to_string(),
        group: group.to_string(),
        status: "exact".to_string(),
        bytes: Some(bytes),
        problem_reason: None,
    }
}

fn unavailable(key: &str, label: &str, group: &str, reason: &str) -> StorageByteInventoryRow {
    StorageByteInventoryRow {
        key: key.to_string(),
        label: label.to_string(),
        group: group.to_string(),
        status: "unavailable".to_string(),
        bytes: None,
        problem_reason: Some(reason.to_string()),
    }
}
