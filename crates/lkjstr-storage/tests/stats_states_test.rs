use lkjstr_storage::{StorageInventoryRow, StorageStatsSnapshot};

#[test]
fn stats_snapshot_keeps_distinct_storage_health_problem_states() {
    for reason in [
        "unavailable",
        "timeout",
        "blocked",
        "corrupt",
        "unknown-old-storage",
    ] {
        let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
            .with_storage_health_problem(reason);

        assert_eq!(snapshot.storage_health_status, reason);
        assert_eq!(snapshot.storage_health_reason.as_deref(), Some(reason));
        assert_eq!(snapshot.storage_health, None);
    }
}

#[test]
fn stats_snapshot_keeps_distinct_pressure_problem_states() {
    for reason in [
        "not-recorded",
        "unavailable",
        "timeout",
        "blocked",
        "corrupt",
        "storage-api-unavailable",
    ] {
        let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
            .with_storage_pressure_problem(reason);

        assert_eq!(snapshot.storage_pressure_status, reason);
        assert_eq!(snapshot.storage_pressure_reason.as_deref(), Some(reason));
        assert_eq!(snapshot.storage_pressure, None);
        assert!(snapshot.byte_rows.iter().all(|row| row.bytes.is_none()));
        assert!(
            snapshot
                .byte_rows
                .iter()
                .all(|row| row.problem_reason.as_deref() == Some(reason))
        );
    }
}

#[test]
fn stats_snapshot_marks_partial_without_hiding_available_rows() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![
        row("events", "available", Some(7), None),
        row("settings", "unavailable", None, Some("blocked")),
    ]);

    assert_eq!(snapshot.inventory_status, "partial");
    assert_eq!(snapshot.available_table_count, 1);
    assert_eq!(snapshot.unavailable_table_count, 1);
    assert_eq!(snapshot.total_known_rows, 7);
}

fn row(
    table: &str,
    status: &str,
    row_count: Option<u64>,
    problem_reason: Option<&str>,
) -> StorageInventoryRow {
    StorageInventoryRow {
        table: table.to_string(),
        data_class: "test".to_string(),
        group: "test".to_string(),
        status: status.to_string(),
        row_count,
        problem_reason: problem_reason.map(str::to_string),
    }
}
