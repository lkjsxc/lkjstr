use lkjstr_storage::{StorageInventoryRow, StorageStatsSnapshot};

#[test]
fn stats_snapshot_can_append_browser_inventory_rows() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![sqlite_row()])
        .with_additional_rows(vec![browser_row(Some(3), Some(512), "available", None)]);

    assert_eq!(snapshot.table_count, 2);
    assert_eq!(snapshot.available_table_count, 2);
    assert_eq!(snapshot.unavailable_table_count, 0);
    assert_eq!(snapshot.total_known_rows, 5);
    assert_eq!(snapshot.inventory_status, "complete");
    assert!(snapshot.rows.iter().any(|row| row.table == "localStorage"
        && row.group == "non-indexed"
        && row.estimated_bytes == Some(512)));
}

#[test]
fn stats_snapshot_marks_unavailable_browser_rows_partial() {
    let snapshot = StorageStatsSnapshot::from_rows(vec![sqlite_row()])
        .with_additional_rows(vec![browser_row(None, None, "unavailable", Some("denied"))]);

    assert_eq!(snapshot.table_count, 2);
    assert_eq!(snapshot.available_table_count, 1);
    assert_eq!(snapshot.unavailable_table_count, 1);
    assert_eq!(snapshot.inventory_status, "partial");
}

fn browser_row(
    row_count: Option<u64>,
    estimated_bytes: Option<u64>,
    status: &str,
    problem_reason: Option<&str>,
) -> StorageInventoryRow {
    StorageInventoryRow {
        table: "localStorage".to_string(),
        data_class: "non-indexed-browser-storage".to_string(),
        group: "non-indexed".to_string(),
        status: status.to_string(),
        row_count,
        estimated_bytes,
        problem_reason: problem_reason.map(str::to_string),
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
