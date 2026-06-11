#![doc = "Retention readiness derived from Stats inventory snapshots."]

use serde::{Deserialize, Serialize};

use super::{StorageInventoryRow, StorageStatsSnapshot};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionInventoryReadiness {
    pub can_plan_retention: bool,
    pub repair_required: bool,
    pub blocking_reason: Option<String>,
    pub storage_mode: String,
    pub known_byte_classes: Vec<String>,
    pub unavailable_byte_classes: Vec<InventoryReadinessGap>,
    pub diagnostic_only_classes: Vec<InventoryReadinessGap>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct InventoryReadinessGap {
    pub key: String,
    pub status: String,
    pub reason: String,
}

#[must_use]
pub fn classify_inventory_for_retention(
    snapshot: &StorageStatsSnapshot,
) -> RetentionInventoryReadiness {
    let known_byte_classes = known_byte_classes(snapshot);
    let unavailable_byte_classes = unavailable_byte_classes(snapshot);
    let diagnostic_only_classes = diagnostic_only_classes(snapshot);
    let storage_mode = snapshot.storage_health_status.clone();
    let blocking_reason = blocking_reason(snapshot, &known_byte_classes);
    let repair_required = repair_required(snapshot);

    RetentionInventoryReadiness {
        can_plan_retention: blocking_reason.is_none(),
        repair_required,
        blocking_reason,
        storage_mode,
        known_byte_classes,
        unavailable_byte_classes,
        diagnostic_only_classes,
    }
}

fn known_byte_classes(snapshot: &StorageStatsSnapshot) -> Vec<String> {
    snapshot
        .byte_rows
        .iter()
        .filter(|row| row.bytes.is_some())
        .map(|row| row.key.clone())
        .collect()
}

fn unavailable_byte_classes(snapshot: &StorageStatsSnapshot) -> Vec<InventoryReadinessGap> {
    snapshot
        .byte_rows
        .iter()
        .filter(|row| row.bytes.is_none())
        .map(|row| {
            gap(
                &row.key,
                &row.status,
                normalized_reason(row.problem_reason.as_deref(), &row.status, "not-recorded"),
            )
        })
        .collect()
}

fn diagnostic_only_classes(snapshot: &StorageStatsSnapshot) -> Vec<InventoryReadinessGap> {
    let mut gaps: Vec<InventoryReadinessGap> = snapshot
        .rows
        .iter()
        .filter(|row| row.data_class == "non-indexed-browser-storage" && row.row_count.is_some())
        .map(|row| gap(&row.table, &row.status, "not-recorded"))
        .collect();
    gaps.extend(unknown_storage_gaps(snapshot));
    gaps
}

fn unknown_storage_gaps(snapshot: &StorageStatsSnapshot) -> Vec<InventoryReadinessGap> {
    let mut gaps: Vec<InventoryReadinessGap> = snapshot
        .rows
        .iter()
        .filter(|row| is_unknown_presence(row))
        .map(|row| gap(&row.table, &row.status, "unknown-unowned-usage"))
        .collect();
    if let Some(pressure) = &snapshot.storage_pressure {
        if pressure.unknown_bytes > 0 {
            gaps.push(gap("unknown-unowned", "exact", "unknown-unowned-usage"));
        }
        if pressure.residual_overhead_bytes > 0 {
            gaps.push(gap(
                "residual-browser-overhead",
                "exact",
                "unknown-unowned-usage",
            ));
        }
    }
    gaps
}

fn blocking_reason(
    snapshot: &StorageStatsSnapshot,
    known_byte_classes: &[String],
) -> Option<String> {
    health_blocking_reason(snapshot)
        .or_else(|| pressure_blocking_reason(snapshot))
        .or_else(|| inventory_blocking_reason(snapshot))
        .or_else(|| prunable_blocking_reason(known_byte_classes))
        .map(str::to_string)
}

fn health_blocking_reason(snapshot: &StorageStatsSnapshot) -> Option<&'static str> {
    match snapshot.storage_health_status.as_str() {
        "available" => None,
        "temporary-memory" | "unavailable" => Some("storage-api-unavailable"),
        "timeout" => Some("timeout"),
        "blocked" => Some("blocked"),
        "corrupt" => Some("corrupt"),
        "unknown-old-storage" => Some("unknown-unowned-usage"),
        _ => Some("storage-api-unavailable"),
    }
}

fn pressure_blocking_reason(snapshot: &StorageStatsSnapshot) -> Option<&'static str> {
    if snapshot.storage_pressure.is_some() {
        None
    } else {
        Some(normalized_reason(
            snapshot.storage_pressure_reason.as_deref(),
            &snapshot.storage_pressure_status,
            "not-recorded",
        ))
    }
}

fn inventory_blocking_reason(snapshot: &StorageStatsSnapshot) -> Option<&'static str> {
    if snapshot.rows.iter().any(is_blocking_inventory_row) {
        Some("inventory-incomplete")
    } else {
        None
    }
}

fn prunable_blocking_reason(known_byte_classes: &[String]) -> Option<&'static str> {
    if known_byte_classes.iter().any(|key| key == "prunable") {
        None
    } else {
        Some("not-recorded")
    }
}

fn is_blocking_inventory_row(row: &StorageInventoryRow) -> bool {
    matches!(
        row.status.as_str(),
        "partial" | "timeout" | "unavailable" | "unsupported"
    )
}

fn repair_required(snapshot: &StorageStatsSnapshot) -> bool {
    snapshot.rows.iter().any(is_unknown_presence)
        || snapshot.storage_pressure.as_ref().is_some_and(|pressure| {
            pressure.unknown_bytes > 0 || pressure.residual_overhead_bytes > 0
        })
}

fn is_unknown_presence(row: &StorageInventoryRow) -> bool {
    row.data_class == "unknown-legacy-or-unowned-storage"
        && row.table != "old-indexeddb:list"
        && !matches!(row.status.as_str(), "unavailable" | "unsupported")
}

fn normalized_reason(
    problem_reason: Option<&str>,
    status: &str,
    default_reason: &'static str,
) -> &'static str {
    let label = problem_reason.unwrap_or(status);
    match label {
        "not-recorded" | "not-requested" | "usage-not-reported" => "not-recorded",
        "timeout" => "timeout",
        "blocked" => "blocked",
        "corrupt" => "corrupt",
        "inventory-incomplete" | "partial" => "inventory-incomplete",
        "unknown-old-storage" | "unknown-unowned-usage" => "unknown-unowned-usage",
        "storage-api-unavailable" | "unavailable" | "unsupported" => "storage-api-unavailable",
        _ => default_reason,
    }
}

fn gap(key: &str, status: &str, reason: &str) -> InventoryReadinessGap {
    InventoryReadinessGap {
        key: key.to_string(),
        status: status.to_string(),
        reason: reason.to_string(),
    }
}
