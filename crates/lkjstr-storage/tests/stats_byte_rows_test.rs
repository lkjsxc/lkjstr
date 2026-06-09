use lkjstr_storage::{StoragePressureSnapshotRecord, StorageStatsSnapshot};

#[test]
fn stats_byte_rows_project_pressure_snapshot() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
        .with_storage_pressure(test_pressure("protected-only"));

    assert_eq!(byte_value(&snapshot, "browser-usage"), Some(96));
    assert_eq!(byte_value(&snapshot, "site-target"), Some(64));
    assert_eq!(byte_value(&snapshot, "protected"), Some(40));
    assert_eq!(byte_value(&snapshot, "prunable"), Some(24));
    assert_eq!(byte_value(&snapshot, "unknown-unowned"), Some(12));
    assert_eq!(byte_value(&snapshot, "residual-browser-overhead"), Some(20));
}

#[test]
fn stats_byte_rows_keep_timeout_unavailable() {
    let snapshot = StorageStatsSnapshot::timeout();

    assert!(
        snapshot
            .byte_rows
            .iter()
            .all(|row| row.status == "unavailable")
    );
    assert!(
        snapshot
            .byte_rows
            .iter()
            .all(|row| row.problem_reason.as_deref() == Some("timeout"))
    );
}

#[test]
fn stats_byte_rows_report_missing_usage_as_unavailable() {
    let mut pressure = test_pressure("inventory-incomplete");
    pressure.usage_bytes = None;

    let snapshot =
        StorageStatsSnapshot::from_sqlite_counts(Vec::new()).with_storage_pressure(pressure);
    let usage = snapshot
        .byte_rows
        .iter()
        .find(|row| row.key == "browser-usage");

    assert_eq!(usage.map(|row| row.status.as_str()), Some("unavailable"));
    assert_eq!(usage.and_then(|row| row.bytes), None);
    assert_eq!(
        usage.and_then(|row| row.problem_reason.as_deref()),
        Some("usage-not-reported")
    );
}

#[test]
fn stats_byte_rows_keep_pressure_problem_unavailable() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
        .with_storage_pressure_problem("blocked");

    assert_eq!(snapshot.storage_pressure_status, "blocked");
    assert!(snapshot.byte_rows.iter().all(|row| row.bytes.is_none()));
    assert!(
        snapshot
            .byte_rows
            .iter()
            .all(|row| row.problem_reason.as_deref() == Some("blocked"))
    );
}

fn byte_value(snapshot: &StorageStatsSnapshot, key: &str) -> Option<u64> {
    snapshot
        .byte_rows
        .iter()
        .find(|row| row.key == key)
        .and_then(|row| row.bytes)
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
