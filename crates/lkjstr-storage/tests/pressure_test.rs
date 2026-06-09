use lkjstr_storage::{
    PRESSURE_STOP_REASONS, StoragePressureSnapshotRecord, StorageProblemKind,
    pressure_problem_kind, pressure_stop_reason_is_known, sqlite_storage_pressure_snapshot_row,
    storage_pressure_from_sqlite_row, storage_pressure_json_bytes, storage_pressure_meta_key,
};

#[test]
fn pressure_stop_reasons_are_stable() {
    for reason in PRESSURE_STOP_REASONS {
        assert!(pressure_stop_reason_is_known(reason));
    }
    assert!(!pressure_stop_reason_is_known("silent-success"));
    assert_eq!(pressure_problem_kind("below-target"), None);
    assert_eq!(pressure_problem_kind("target-met"), None);
    assert_eq!(
        StorageProblemKind::PressureSnapshotDecodeFailed.as_str(),
        "pressure-snapshot-decode-failed"
    );
}

#[test]
fn pressure_problem_kind_maps_every_problem_stop_reason() {
    let expected = [
        (
            "no-prunable-candidates",
            StorageProblemKind::PressureNoPrunableCandidates,
        ),
        ("protected-only", StorageProblemKind::PressureProtectedOnly),
        (
            "unknown-unowned-usage",
            StorageProblemKind::PressureUnknownUsage,
        ),
        (
            "inventory-incomplete",
            StorageProblemKind::PressureInventoryIncomplete,
        ),
        ("quota-pressure", StorageProblemKind::PressureQuota),
        (
            "storage-api-unavailable",
            StorageProblemKind::PressureStorageApiUnavailable,
        ),
        (
            "compaction-error",
            StorageProblemKind::PressureCompactionError,
        ),
        ("deadline", StorageProblemKind::PressureDeadline),
    ];

    for (reason, kind) in expected {
        assert_eq!(pressure_problem_kind(reason), Some(kind));
        assert!(pressure_stop_reason_is_known(reason));
    }
}

#[test]
fn pressure_snapshot_round_trips_through_sqlite_row() -> Result<(), serde_json::Error> {
    let snapshot = StoragePressureSnapshotRecord {
        target_bytes: 64,
        usage_bytes: Some(96),
        protected_bytes: 40,
        prunable_bytes: 24,
        unknown_bytes: 12,
        residual_overhead_bytes: 20,
        pruned_bytes: 8,
        pruned_resource_count: 2,
        stop_reason: "unknown-unowned-usage".to_owned(),
        checked_at_ms: 123,
    };

    let sqlite = sqlite_storage_pressure_snapshot_row(&snapshot)?;
    assert_eq!(sqlite.key, storage_pressure_meta_key());
    assert!(storage_pressure_json_bytes(&snapshot)? > 0);
    assert_eq!(storage_pressure_from_sqlite_row(&sqlite)?, snapshot);
    assert_eq!(
        pressure_problem_kind(&snapshot.stop_reason),
        Some(StorageProblemKind::PressureUnknownUsage)
    );
    Ok(())
}
