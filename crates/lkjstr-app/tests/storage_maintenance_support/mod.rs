use lkjstr_app::StorageMaintenanceInput;
use lkjstr_storage::{
    CacheResourceKind, RepairScanRow, RepairTargetState, RetentionCandidate, SqliteStorageHealth,
    StorageInventoryRow, StoragePressureSnapshotRecord, StorageStatsSnapshot,
};

pub(crate) fn input(
    snapshot: StorageStatsSnapshot,
    retention_candidates: Vec<RetentionCandidate>,
) -> StorageMaintenanceInput {
    let mut input = StorageMaintenanceInput::new(snapshot);
    input.retention_candidates = retention_candidates;
    input
}

pub(crate) fn ready_snapshot() -> StorageStatsSnapshot {
    StorageStatsSnapshot::from_rows(Vec::new())
        .with_storage_health(health())
        .with_storage_pressure(pressure_snapshot())
}

pub(crate) fn pressure_snapshot() -> StoragePressureSnapshotRecord {
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

pub(crate) fn health() -> SqliteStorageHealth {
    SqliteStorageHealth {
        mode: "opfs".to_string(),
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

pub(crate) fn browser_count_row(
    table: &str,
    status: &str,
    row_count: Option<u64>,
) -> StorageInventoryRow {
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

pub(crate) fn old_indexed_db_row() -> StorageInventoryRow {
    unknown_row("old-indexeddb:lkjstr-v1", "old IndexedDB database presence")
}

pub(crate) fn unknown_storage_row() -> StorageInventoryRow {
    unknown_row("unknown-cache:unowned", "unowned browser cache")
}

pub(crate) fn candidate(id: &str, byte_count: u64, protected: bool) -> RetentionCandidate {
    RetentionCandidate {
        resource_id: id.to_string(),
        resource_kind: CacheResourceKind::NostrEvent,
        table_name: "events".to_string(),
        byte_count,
        score: 1,
        updated_at_ms: 1,
        protected,
        ledger_backed: true,
        recoverable: true,
    }
}

pub(crate) fn repair_row() -> RepairScanRow {
    RepairScanRow {
        table_name: "events".to_string(),
        resource_id: "event-1".to_string(),
        ledger_state: RepairTargetState::Present,
        target_state: RepairTargetState::Present,
        protected: false,
        known_owner: true,
        decode_ok: true,
        corrupt: false,
    }
}

fn unknown_row(table: &str, reason: &str) -> StorageInventoryRow {
    StorageInventoryRow {
        table: table.to_string(),
        data_class: "unknown-legacy-or-unowned-storage".to_string(),
        group: "unknown".to_string(),
        status: "estimated".to_string(),
        row_count: None,
        estimated_bytes: None,
        problem_reason: Some(reason.to_string()),
    }
}
