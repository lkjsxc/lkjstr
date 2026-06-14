use lkjstr_storage::{
    SqliteStorageHealth, StorageInventoryRow, StoragePressureSnapshotRecord, StorageStatsSnapshot,
    stats::classify_inventory_for_retention,
};

#[test]
fn stats_readiness_complete_pressure_permits_retention_planning() {
    let readiness = classify_inventory_for_retention(&ready_snapshot());

    assert!(readiness.can_plan_retention);
    assert_eq!(readiness.blocking_reason, None);
    assert!(!readiness.repair_required);
    assert!(has_known_byte(&readiness.known_byte_classes, "prunable"));
}

#[test]
fn stats_readiness_missing_pressure_blocks_retention() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![sqlite_row()])
        .with_storage_health(persistent_health())
        .with_storage_pressure_problem("not-recorded");

    let readiness = classify_inventory_for_retention(&snapshot);

    assert!(!readiness.can_plan_retention);
    assert_eq!(readiness.blocking_reason.as_deref(), Some("not-recorded"));
    assert!(
        readiness
            .unavailable_byte_classes
            .iter()
            .all(|gap| gap.reason == "not-recorded")
    );
}

#[test]
fn stats_readiness_old_indexeddb_is_unknown_unowned() {
    let snapshot = ready_snapshot().with_additional_rows(vec![old_indexed_db_row()]);

    let readiness = classify_inventory_for_retention(&snapshot);

    assert!(readiness.repair_required);
    assert!(has_gap(
        &readiness.diagnostic_only_classes,
        "old-indexeddb:lkjstr-v1",
        "unknown-unowned-usage",
    ));
}

#[test]
fn stats_readiness_count_rows_stay_diagnostic_not_bytes() {
    let snapshot = ready_snapshot().with_additional_rows(vec![
        browser_count_row("localStorage", "available", Some(3)),
        browser_count_row("Cache Storage", "exact", Some(8)),
    ]);

    let readiness = classify_inventory_for_retention(&snapshot);

    assert!(readiness.can_plan_retention);
    assert!(!has_known_byte(
        &readiness.known_byte_classes,
        "localStorage"
    ));
    assert!(has_gap(
        &readiness.diagnostic_only_classes,
        "localStorage",
        "not-recorded",
    ));
    assert!(has_gap(
        &readiness.diagnostic_only_classes,
        "Cache Storage",
        "not-recorded",
    ));
}

#[test]
fn stats_readiness_partial_cache_storage_blocks() {
    for status in ["partial", "timeout"] {
        let snapshot = ready_snapshot().with_additional_rows(vec![browser_count_row(
            "Cache Storage",
            status,
            None,
        )]);
        let readiness = classify_inventory_for_retention(&snapshot);

        assert!(!readiness.can_plan_retention);
        assert_eq!(
            readiness.blocking_reason.as_deref(),
            Some("inventory-incomplete")
        );
    }
}

#[test]
fn stats_readiness_temporary_memory_remains_explicit() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![sqlite_row()])
        .with_storage_health(temporary_memory_health())
        .with_storage_pressure(pressure_snapshot());

    let readiness = classify_inventory_for_retention(&snapshot);

    assert!(!readiness.can_plan_retention);
    assert_eq!(readiness.storage_mode, "temporary-memory");
    assert_eq!(
        readiness.blocking_reason.as_deref(),
        Some("storage-api-unavailable")
    );
}

fn ready_snapshot() -> StorageStatsSnapshot {
    StorageStatsSnapshot::from_rows(vec![sqlite_row()])
        .with_storage_health(persistent_health())
        .with_storage_pressure(pressure_snapshot())
}

fn pressure_snapshot() -> StoragePressureSnapshotRecord {
    StoragePressureSnapshotRecord {
        target_bytes: 100,
        usage_bytes: Some(180),
        protected_bytes: 40,
        prunable_bytes: 80,
        unknown_bytes: 0,
        residual_overhead_bytes: 0,
        pruned_bytes: 0,
        pruned_resource_count: 0,
        stop_reason: "quota-pressure".to_string(),
        checked_at_ms: 123,
    }
}

fn persistent_health() -> SqliteStorageHealth {
    health("opfs")
}

fn temporary_memory_health() -> SqliteStorageHealth {
    health("temporary-memory")
}

fn health(mode: &str) -> SqliteStorageHealth {
    SqliteStorageHealth {
        mode: mode.to_string(),
        vfs_name: "opfs-sahpool".to_string(),
        worker_kind: "sqlite".to_string(),
        sqlite_version: "test".to_string(),
        database_name: "lkjstr-test".to_string(),
        applied_schema_changes: Vec::new(),
        page_count: 1,
        page_size: 4096,
        freelist_count: 0,
        event_count: 0,
        relay_receipt_count: 0,
        tag_row_count: 0,
        last_integrity_check_at: None,
        warnings: Vec::new(),
    }
}

fn sqlite_row() -> StorageInventoryRow {
    StorageInventoryRow {
        table: "events".to_string(),
        data_class: "recoverable-cache".to_string(),
        group: "prunable-cache".to_string(),
        status: "available".to_string(),
        row_count: Some(2),
        estimated_bytes: None,
        problem_reason: None,
    }
}

fn old_indexed_db_row() -> StorageInventoryRow {
    StorageInventoryRow {
        table: "old-indexeddb:lkjstr-v1".to_string(),
        data_class: "unknown-legacy-or-unowned-storage".to_string(),
        group: "unknown".to_string(),
        status: "estimated".to_string(),
        row_count: None,
        estimated_bytes: None,
        problem_reason: Some("old IndexedDB database presence; row scan skipped".to_string()),
    }
}

fn browser_count_row(table: &str, status: &str, row_count: Option<u64>) -> StorageInventoryRow {
    StorageInventoryRow {
        table: table.to_string(),
        data_class: "non-indexed-browser-storage".to_string(),
        group: "non-indexed".to_string(),
        status: status.to_string(),
        row_count,
        estimated_bytes: row_count.map(|count| count.saturating_mul(256)),
        problem_reason: None,
    }
}

fn has_known_byte(classes: &[String], key: &str) -> bool {
    classes.iter().any(|item| item == key)
}

fn has_gap(gaps: &[lkjstr_storage::stats::InventoryReadinessGap], key: &str, reason: &str) -> bool {
    gaps.iter()
        .any(|gap| gap.key == key && gap.reason == reason)
}
