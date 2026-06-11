use lkjstr_app::plan_storage_maintenance;
use lkjstr_storage::{
    RepairFindingKind, RetentionStopReason, StoragePressureSnapshotRecord, StorageStatsSnapshot,
};

mod storage_maintenance_support;

use storage_maintenance_support::*;

#[test]
fn ready_pressure_snapshot_plans_retention() {
    let plan = plan_storage_maintenance(input(
        ready_snapshot(),
        vec![candidate("event-1", 90, false)],
    ));

    assert!(plan.readiness.can_plan_retention);
    assert_eq!(plan.retention.intents[0].resource_id, "event-1");
    assert_eq!(plan.retention.stop_reason, None);
    assert!(!plan.repair.should_report);
}

#[test]
fn diagnostic_browser_rows_do_not_replace_pressure_bytes() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![
        browser_count_row("localStorage", "exact", Some(3)),
        old_indexed_db_row(),
    ])
    .with_storage_health(health())
    .with_storage_pressure_problem("not-recorded");

    let plan = plan_storage_maintenance(input(snapshot, vec![candidate("event-1", 90, false)]));

    assert!(!plan.readiness.can_plan_retention);
    assert_eq!(
        plan.readiness.blocking_reason.as_deref(),
        Some("not-recorded")
    );
    assert!(plan.readiness.repair_required);
    assert!(plan.retention.intents.is_empty());
    assert!(plan.repair.should_report);
    assert!(
        plan.readiness
            .diagnostic_only_classes
            .iter()
            .any(|gap| { gap.key == "localStorage" && gap.reason == "not-recorded" })
    );
    assert!(plan.readiness.diagnostic_only_classes.iter().any(|gap| {
        gap.key == "old-indexeddb:lkjstr-v1" && gap.reason == "unknown-unowned-usage"
    }));
}

#[test]
fn unknown_browser_inventory_does_not_replace_pressure_bytes() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![unknown_storage_row()])
        .with_storage_health(health())
        .with_storage_pressure_problem("not-recorded");

    let plan = plan_storage_maintenance(input(snapshot, vec![candidate("event-1", 90, false)]));

    assert!(plan.readiness.repair_required);
    assert!(plan.retention.intents.is_empty());
    assert!(plan.repair.should_report);
    assert!(plan.readiness.diagnostic_only_classes.iter().any(|gap| {
        gap.key == "unknown-cache:unowned" && gap.reason == "unknown-unowned-usage"
    }));
}

#[test]
fn residual_browser_overhead_keeps_unknown_stop_reason() {
    let snapshot = ready_snapshot().with_storage_pressure(StoragePressureSnapshotRecord {
        usage_bytes: Some(200),
        residual_overhead_bytes: 80,
        prunable_bytes: 20,
        ..pressure_snapshot()
    });

    let plan = plan_storage_maintenance(input(snapshot, vec![candidate("event-1", 20, false)]));

    assert_eq!(
        plan.retention.stop_reason,
        Some(RetentionStopReason::UnknownUnownedUsage)
    );
    assert!(plan.readiness.repair_required);
}

#[test]
fn protected_candidates_are_never_pruned() {
    let plan = plan_storage_maintenance(input(
        ready_snapshot(),
        vec![candidate("event-1", 100, true)],
    ));

    assert!(plan.retention.intents.is_empty());
    assert_eq!(
        plan.retention.stop_reason,
        Some(RetentionStopReason::ProtectedOnly)
    );
    assert_eq!(plan.retention.summary.skipped_protected_count, 1);
}

#[test]
fn repair_consumes_incomplete_inventory_readiness() {
    let snapshot = ready_snapshot().with_additional_rows(vec![browser_count_row(
        "Cache Storage",
        "partial",
        None,
    )]);
    let mut request = input(snapshot, vec![candidate("event-1", 90, false)]);
    request.repair_rows = vec![repair_row()];

    let plan = plan_storage_maintenance(request);
    let scan_findings = plan
        .repair
        .scan
        .map(|scan| scan.findings)
        .unwrap_or_default();

    assert!(!plan.readiness.can_plan_retention);
    assert!(plan.retention.intents.is_empty());
    assert!(plan.repair.should_report);
    assert!(
        plan.repair
            .inventory
            .findings
            .iter()
            .any(|finding| finding.kind == RepairFindingKind::IncompleteInventory)
    );
    assert!(
        scan_findings
            .iter()
            .any(|finding| finding.kind == RepairFindingKind::IncompleteInventory)
    );
}
