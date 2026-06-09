use lkjstr_storage::{
    SqliteRowCount, SqliteStorageHealth, StoragePressureSnapshotRecord, StorageStatsSnapshot,
    StorageTableCount, sqlite_schema_table_names, sqlite_table_count_sql, storage_table_specs,
};

#[test]
fn stats_snapshot_marks_complete_inventory() {
    let counts = storage_table_specs()
        .iter()
        .map(|spec| StorageTableCount::available(spec.name, 2))
        .collect();
    let snapshot = StorageStatsSnapshot::from_counts(counts);

    assert_eq!(snapshot.inventory_status, "complete");
    assert_eq!(snapshot.available_table_count, snapshot.table_count);
    assert_eq!(snapshot.unavailable_table_count, 0);
    assert_eq!(snapshot.total_known_rows, (snapshot.table_count as u64) * 2);
}

#[test]
fn stats_snapshot_marks_partial_inventory() {
    let counts = vec![
        StorageTableCount::available("workspaces", 1),
        StorageTableCount::unavailable("settings", "blocked"),
    ];
    let snapshot = StorageStatsSnapshot::from_counts(counts);
    assert_eq!(snapshot.inventory_status, "partial");
    assert!(snapshot.rows.iter().any(|row| row.table == "workspaces"
        && row.status == "available"
        && row.row_count == Some(1)));
    assert!(snapshot.rows.iter().any(|row| row.table == "settings"
        && row.status == "unavailable"
        && row.problem_reason.as_deref() == Some("blocked")));
}

#[test]
fn stats_snapshot_can_report_manifest_unavailable() {
    let snapshot = StorageStatsSnapshot::manifest_unavailable("unavailable");

    assert_eq!(snapshot.inventory_status, "unavailable");
    assert_eq!(snapshot.storage_health_status, "unavailable");
    assert_eq!(snapshot.available_table_count, 0);
    assert!(snapshot.rows.iter().all(|row| row.status == "unavailable"));
}

#[test]
fn stats_snapshot_can_report_timeout() {
    let snapshot = StorageStatsSnapshot::timeout();

    assert_eq!(snapshot.inventory_status, "unavailable");
    assert_eq!(snapshot.storage_health_status, "timeout");
    assert_eq!(snapshot.storage_pressure_status, "timeout");
    assert!(snapshot.rows.iter().all(|row| row.status == "unavailable"));
}

#[test]
fn stats_snapshot_can_report_sqlite_storage_health() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
        .with_storage_health(test_health("temporary-memory"));

    assert_eq!(snapshot.storage_health_status, "temporary-memory");
    assert_eq!(
        snapshot.storage_health.as_ref().map(|item| item.page_size),
        Some(4096)
    );
    assert_eq!(snapshot.storage_health_reason, None);
}

#[test]
fn stats_snapshot_reports_persistent_health_as_available() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
        .with_storage_health(test_health("persistent-opfs"));

    assert_eq!(snapshot.storage_health_status, "available");
    assert_eq!(
        snapshot
            .storage_health
            .as_ref()
            .map(|item| item.mode.as_str()),
        Some("persistent-opfs")
    );
}

#[test]
fn stats_snapshot_can_report_storage_health_problem() {
    let snapshot =
        StorageStatsSnapshot::from_sqlite_counts(Vec::new()).with_storage_health_problem("timeout");

    assert_eq!(snapshot.storage_health_status, "timeout");
    assert_eq!(snapshot.storage_health_reason.as_deref(), Some("timeout"));
    assert_eq!(snapshot.storage_health, None);
}

#[test]
fn stats_snapshot_can_report_pressure_snapshot() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
        .with_storage_pressure(test_pressure("protected-only"));

    assert_eq!(snapshot.storage_pressure_status, "protected-only");
    assert_eq!(snapshot.storage_pressure_reason, None);
    assert_eq!(
        snapshot
            .storage_pressure
            .as_ref()
            .map(|item| item.protected_bytes),
        Some(40)
    );
    assert_eq!(
        snapshot
            .storage_pressure
            .as_ref()
            .map(|item| item.residual_overhead_bytes),
        Some(20)
    );
}

#[test]
fn stats_snapshot_can_use_sqlite_schema_tables() {
    let counts = sqlite_schema_table_names()
        .into_iter()
        .map(|table| StorageTableCount::available(table, 3))
        .collect();
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(counts);

    assert_eq!(snapshot.inventory_status, "complete");
    assert!(
        snapshot
            .rows
            .iter()
            .any(|row| row.table == "relay_information"
                && row.group == "diagnostics"
                && row.row_count == Some(3))
    );
}

#[test]
fn sqlite_table_count_sql_is_limited_to_known_tables() -> Result<(), serde_json::Error> {
    assert_eq!(
        sqlite_table_count_sql("events").as_deref(),
        Some("SELECT COUNT(*) AS row_count FROM events;")
    );
    assert!(sqlite_table_count_sql("events; DROP TABLE events").is_none());
    assert_eq!(
        serde_json::from_value::<SqliteRowCount>(serde_json::json!({ "row_count": 4 }))?.row_count,
        4
    );
    Ok(())
}

fn test_pressure(stop_reason: &str) -> StoragePressureSnapshotRecord {
    StoragePressureSnapshotRecord {
        target_bytes: 64,
        usage_bytes: Some(96),
        protected_bytes: 40,
        prunable_bytes: 24,
        unknown_bytes: 12,
        residual_overhead_bytes: 20,
        pruned_bytes: 8,
        pruned_resource_count: 2,
        stop_reason: stop_reason.to_string(),
        checked_at_ms: 123,
    }
}

fn test_health(mode: &str) -> SqliteStorageHealth {
    SqliteStorageHealth {
        mode: mode.to_string(),
        vfs_name: "memory".to_string(),
        worker_kind: "dedicated".to_string(),
        sqlite_version: "3.test".to_string(),
        database_name: ":memory:".to_string(),
        applied_schema_changes: vec!["schema".to_string()],
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
