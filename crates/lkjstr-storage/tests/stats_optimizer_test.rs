use lkjstr_storage::{StorageStatsSnapshot, StorageTableCount};

#[test]
fn stats_snapshot_projects_scan_optimizer_counts() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(vec![
        StorageTableCount::available("feed_scan_hints", 23),
        StorageTableCount::available("feed_scan_decision_traces", 19),
        StorageTableCount::available("feed_scan_density_models", 11),
    ]);

    assert_eq!(snapshot.optimizer.status, "available");
    assert_eq!(snapshot.optimizer.scan_hint_rows, Some(23));
    assert_eq!(snapshot.optimizer.decision_trace_rows, Some(19));
    assert_eq!(snapshot.optimizer.density_model_rows, Some(11));
    assert_eq!(snapshot.optimizer.problem_reason, None);
}

#[test]
fn stats_snapshot_reports_partial_scan_optimizer_counts() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(vec![
        StorageTableCount::available("feed_scan_hints", 23),
        StorageTableCount::unavailable("feed_scan_decision_traces", "blocked"),
    ]);

    assert_eq!(snapshot.optimizer.status, "partial");
    assert_eq!(snapshot.optimizer.scan_hint_rows, Some(23));
    assert_eq!(snapshot.optimizer.decision_trace_rows, None);
    assert_eq!(snapshot.optimizer.density_model_rows, None);
    assert_eq!(
        snapshot.optimizer.problem_reason.as_deref(),
        Some("blocked")
    );
}
