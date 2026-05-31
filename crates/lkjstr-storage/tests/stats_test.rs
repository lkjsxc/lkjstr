use lkjstr_storage::{StorageStatsSnapshot, StorageTableCount, storage_table_specs};

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
    assert_eq!(snapshot.available_table_count, 0);
    assert!(snapshot.rows.iter().all(|row| row.status == "unavailable"));
}
