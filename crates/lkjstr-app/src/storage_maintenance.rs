#![doc = "Storage maintenance product planning."]

use lkjstr_storage::{
    RepairInventoryReportInput, RepairInventoryReportOutput, RepairScanInput, RepairScanOutput,
    RepairScanRow, RetentionByteTarget, RetentionCandidate, RetentionDynamicProtection,
    RetentionPlan, RetentionPlanInput, StoragePressureSnapshotRecord, StorageStatsSnapshot,
    plan_retention, report_repair_inventory, scan_repair,
    stats::{RetentionInventoryReadiness, classify_inventory_for_retention},
};

#[derive(Clone, Debug, PartialEq)]
pub struct StorageMaintenanceInput {
    pub snapshot: StorageStatsSnapshot,
    pub retention_candidates: Vec<RetentionCandidate>,
    pub dynamic_protections: Vec<RetentionDynamicProtection>,
    pub compaction_error: bool,
    pub quota_pressure: bool,
    pub repair_rows: Vec<RepairScanRow>,
    pub repair_after_resource_id: Option<String>,
    pub repair_limit: usize,
    pub repair_schema_matches: bool,
    pub repair_next_cursor: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct StorageMaintenancePlan {
    pub readiness: RetentionInventoryReadiness,
    pub retention: RetentionPlan,
    pub repair: StorageRepairConsumption,
}

#[derive(Clone, Debug, PartialEq)]
pub struct StorageRepairConsumption {
    pub should_report: bool,
    pub inventory: RepairInventoryReportOutput,
    pub scan: Option<RepairScanOutput>,
}

impl StorageMaintenanceInput {
    #[must_use]
    pub fn new(snapshot: StorageStatsSnapshot) -> Self {
        Self {
            snapshot,
            retention_candidates: Vec::new(),
            dynamic_protections: Vec::new(),
            compaction_error: false,
            quota_pressure: false,
            repair_rows: Vec::new(),
            repair_after_resource_id: None,
            repair_limit: 128,
            repair_schema_matches: true,
            repair_next_cursor: None,
        }
    }
}

#[must_use]
pub fn plan_storage_maintenance(input: StorageMaintenanceInput) -> StorageMaintenancePlan {
    let readiness = classify_inventory_for_retention(&input.snapshot);
    let retention = plan_retention(retention_input(&input, &readiness));
    let repair = repair_consumption(&input, &readiness);
    StorageMaintenancePlan {
        readiness,
        retention,
        repair,
    }
}

fn retention_input(
    input: &StorageMaintenanceInput,
    readiness: &RetentionInventoryReadiness,
) -> RetentionPlanInput {
    let pressure = input.snapshot.storage_pressure.as_ref();
    let can_use_pressure = readiness.can_plan_retention && pressure.is_some();
    RetentionPlanInput {
        byte_target: RetentionByteTarget {
            target_bytes: pressure.map_or(0, |item| item.target_bytes),
            usage_bytes: can_use_pressure
                .then(|| pressure.and_then(|item| item.usage_bytes))
                .flatten(),
        },
        candidates: if can_use_pressure {
            input.retention_candidates.clone()
        } else {
            Vec::new()
        },
        dynamic_protections: input.dynamic_protections.clone(),
        inventory_complete: inventory_complete(readiness),
        storage_api_available: storage_api_available(readiness),
        quota_pressure: input.quota_pressure,
        compaction_error: input.compaction_error,
        unknown_unowned_usage_bytes: unknown_unowned_usage_bytes(pressure),
    }
}

fn repair_consumption(
    input: &StorageMaintenanceInput,
    readiness: &RetentionInventoryReadiness,
) -> StorageRepairConsumption {
    let inventory = report_repair_inventory(RepairInventoryReportInput {
        inventory_complete: inventory_complete(readiness),
        temporary_memory_mode: readiness.storage_mode == "temporary-memory",
        table_count: input.snapshot.table_count,
        next_cursor: input.repair_next_cursor.clone(),
    });
    let scan = (!input.repair_rows.is_empty()).then(|| {
        scan_repair(RepairScanInput {
            rows: input.repair_rows.clone(),
            after_resource_id: input.repair_after_resource_id.clone(),
            limit: input.repair_limit,
            inventory_complete: inventory_complete(readiness),
            temporary_memory_mode: readiness.storage_mode == "temporary-memory",
            schema_matches: input.repair_schema_matches,
        })
    });
    let scan_has_findings = scan
        .as_ref()
        .is_some_and(|output| !output.findings.is_empty());
    StorageRepairConsumption {
        should_report: readiness.repair_required
            || !readiness.can_plan_retention
            || !inventory.findings.is_empty()
            || scan_has_findings,
        inventory,
        scan,
    }
}

fn inventory_complete(readiness: &RetentionInventoryReadiness) -> bool {
    readiness.blocking_reason.as_deref() != Some("inventory-incomplete")
}

fn storage_api_available(readiness: &RetentionInventoryReadiness) -> bool {
    !matches!(
        readiness.blocking_reason.as_deref(),
        Some("storage-api-unavailable" | "timeout" | "blocked" | "corrupt")
    )
}

fn unknown_unowned_usage_bytes(pressure: Option<&StoragePressureSnapshotRecord>) -> u64 {
    pressure.map_or(0, |item| {
        item.unknown_bytes
            .saturating_add(item.residual_overhead_bytes)
    })
}
