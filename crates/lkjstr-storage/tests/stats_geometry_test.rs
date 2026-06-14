use lkjstr_storage::{StorageStatsSnapshot, StorageTableCount};

#[test]
fn stats_snapshot_projects_feed_geometry_counts() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(vec![
        StorageTableCount::available("feed_row_height_observations", 12),
        StorageTableCount::available("feed_row_height_models", 3),
    ]);

    assert_eq!(snapshot.feed_geometry.status, "available");
    assert_eq!(snapshot.feed_geometry.observation_rows, Some(12));
    assert_eq!(snapshot.feed_geometry.model_rows, Some(3));
    assert_eq!(snapshot.feed_geometry.problem_reason, None);
}

#[test]
fn stats_snapshot_reports_partial_feed_geometry_counts() {
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(vec![
        StorageTableCount::available("feed_row_height_observations", 12),
        StorageTableCount::unavailable("feed_row_height_models", "blocked"),
    ]);

    assert_eq!(snapshot.feed_geometry.status, "partial");
    assert_eq!(snapshot.feed_geometry.observation_rows, Some(12));
    assert_eq!(snapshot.feed_geometry.model_rows, None);
    assert_eq!(
        snapshot.feed_geometry.problem_reason.as_deref(),
        Some("blocked")
    );
}
