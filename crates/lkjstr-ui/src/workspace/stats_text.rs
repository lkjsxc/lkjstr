use lkjstr_storage::{StoragePressureSnapshotRecord, StorageStatsSnapshot};

pub(crate) fn status_text(snapshot: Option<StorageStatsSnapshot>) -> String {
    snapshot.map_or_else(|| "loading".to_string(), |item| item.inventory_status)
}

pub(crate) fn available_text(snapshot: Option<StorageStatsSnapshot>) -> String {
    snapshot.map_or_else(
        || "loading".to_string(),
        |item| format!("{}/{}", item.available_table_count, item.table_count),
    )
}

pub(crate) fn unavailable_text(snapshot: Option<StorageStatsSnapshot>) -> usize {
    snapshot.map_or(0, |item| item.unavailable_table_count)
}

pub(crate) fn pressure_state_text(snapshot: Option<StorageStatsSnapshot>) -> String {
    snapshot.map_or_else(
        || "loading".to_string(),
        |item| match item.storage_pressure {
            Some(pressure) => pressure.stop_reason,
            None => item
                .storage_pressure_reason
                .unwrap_or(item.storage_pressure_status),
        },
    )
}

pub(crate) fn pressure_value_text(
    snapshot: Option<StorageStatsSnapshot>,
    value: fn(&StoragePressureSnapshotRecord) -> u64,
) -> String {
    snapshot.map_or_else(
        || "loading".to_string(),
        |item| match item.storage_pressure.as_ref() {
            Some(pressure) => value(pressure).to_string(),
            None => item
                .storage_pressure_reason
                .unwrap_or(item.storage_pressure_status),
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_stays_loading_only_before_snapshot() {
        assert_eq!(status_text(None), "loading");
        assert_eq!(available_text(None), "loading");
        assert_eq!(pressure_state_text(None), "loading");

        let snapshot = StorageStatsSnapshot::timeout();
        assert_eq!(status_text(Some(snapshot.clone())), "unavailable");
        assert_eq!(pressure_state_text(Some(snapshot.clone())), "timeout");
        assert_eq!(
            pressure_value_text(Some(snapshot), |item| item.protected_bytes),
            "timeout"
        );
    }

    #[test]
    fn pressure_text_uses_exact_unavailable_reason() {
        let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
            .with_storage_pressure_problem("blocked");

        assert_eq!(pressure_state_text(Some(snapshot.clone())), "blocked");
        assert_eq!(
            pressure_value_text(Some(snapshot), |item| item.prunable_bytes),
            "blocked"
        );
    }

    #[test]
    fn pressure_text_uses_real_snapshot_values() {
        let snapshot = StorageStatsSnapshot::from_sqlite_counts(Vec::new())
            .with_storage_pressure(test_pressure("unknown-unowned-usage"));

        assert_eq!(
            pressure_state_text(Some(snapshot.clone())),
            "unknown-unowned-usage"
        );
        assert_eq!(
            pressure_value_text(Some(snapshot), |item| item.unknown_bytes),
            "12"
        );
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
}
