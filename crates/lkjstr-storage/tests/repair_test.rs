use lkjstr_storage::{
    RepairBackfillInput, RepairBackfillPlan, RepairFindingKind, RepairInventoryReportInput,
    RepairScanInput, RepairScanRow, RepairTargetState, plan_repair_backfill,
    report_repair_inventory, scan_repair,
};

#[test]
fn repair_finding_labels_are_stable() {
    let labels: Vec<_> = [
        RepairFindingKind::SchemaMismatch,
        RepairFindingKind::CorruptRow,
        RepairFindingKind::DecodeFailure,
        RepairFindingKind::OrphanLedgerRow,
        RepairFindingKind::OrphanResourceRow,
        RepairFindingKind::IncompleteInventory,
        RepairFindingKind::TemporaryMemoryMode,
        RepairFindingKind::UnknownUnownedRow,
        RepairFindingKind::SkippedUnknownRow,
        RepairFindingKind::BackfillPlanned,
        RepairFindingKind::BackfillApplied,
        RepairFindingKind::ChunkContinuation,
    ]
    .into_iter()
    .map(RepairFindingKind::as_str)
    .collect();
    assert_eq!(
        labels,
        [
            "schema-mismatch",
            "corrupt-row",
            "decode-failure",
            "orphan-ledger-row",
            "orphan-resource-row",
            "incomplete-inventory",
            "temporary-memory-mode",
            "unknown-unowned-row",
            "skipped-unknown-row",
            "backfill-planned",
            "backfill-applied",
            "chunk-continuation",
        ]
    );
}

#[test]
fn repair_scan_reports_before_any_cleanup() {
    let output = scan_repair(RepairScanInput {
        rows: vec![
            scan_row("events", "event-1", RepairTargetState::Missing, false, true),
            scan_row("mystery", "raw-1", RepairTargetState::Missing, false, false),
            RepairScanRow {
                ledger_state: RepairTargetState::Missing,
                ..scan_row("events", "event-3", RepairTargetState::Present, false, true)
            },
            scan_row("events", "event-2", RepairTargetState::Present, false, true),
        ],
        after_resource_id: None,
        limit: 10,
        inventory_complete: false,
        temporary_memory_mode: true,
        schema_matches: false,
    });
    let kinds: Vec<_> = output.findings.iter().map(|finding| finding.kind).collect();
    assert!(kinds.contains(&RepairFindingKind::SchemaMismatch));
    assert!(kinds.contains(&RepairFindingKind::TemporaryMemoryMode));
    assert!(kinds.contains(&RepairFindingKind::IncompleteInventory));
    assert!(kinds.contains(&RepairFindingKind::OrphanLedgerRow));
    assert!(kinds.contains(&RepairFindingKind::OrphanResourceRow));
    assert!(kinds.contains(&RepairFindingKind::UnknownUnownedRow));
    assert!(kinds.contains(&RepairFindingKind::SkippedUnknownRow));
    assert_eq!(output.scanned_count, 4);
    assert!(!output.chunk_continues);
}

#[test]
fn repair_scan_is_chunkable_and_resumable() {
    let output = scan_repair(RepairScanInput {
        rows: vec![
            scan_row("events", "event-1", RepairTargetState::Present, false, true),
            scan_row("events", "event-2", RepairTargetState::Present, false, true),
        ],
        after_resource_id: None,
        limit: 1,
        inventory_complete: true,
        temporary_memory_mode: false,
        schema_matches: true,
    });
    assert_eq!(output.scanned_count, 1);
    assert_eq!(output.next_cursor.as_deref(), Some("event-1"));
    assert!(output.chunk_continues);
    assert_eq!(
        output.findings.last().map(|finding| finding.kind),
        Some(RepairFindingKind::ChunkContinuation)
    );
}

#[test]
fn repair_backfill_only_applies_safe_missing_rows() {
    let output = plan_repair_backfill(RepairBackfillInput {
        apply: true,
        plans: vec![
            backfill_plan("events", "event-1", false, true),
            backfill_plan("events", "event-2", true, true),
            backfill_plan("mystery", "raw-1", false, false),
        ],
    });
    let kinds: Vec<_> = output.findings.iter().map(|finding| finding.kind).collect();
    assert_eq!(output.planned_count, 1);
    assert_eq!(output.applied_count, 1);
    assert_eq!(output.skipped_count, 2);
    assert!(kinds.contains(&RepairFindingKind::BackfillPlanned));
    assert!(kinds.contains(&RepairFindingKind::BackfillApplied));
    assert!(kinds.contains(&RepairFindingKind::SkippedUnknownRow));
}

#[test]
fn repair_inventory_reports_mode_and_continuation() {
    let output = report_repair_inventory(RepairInventoryReportInput {
        inventory_complete: false,
        temporary_memory_mode: true,
        table_count: 8,
        next_cursor: Some("events".to_owned()),
    });
    let kinds: Vec<_> = output.findings.iter().map(|finding| finding.kind).collect();
    assert_eq!(output.table_count, 8);
    assert!(kinds.contains(&RepairFindingKind::IncompleteInventory));
    assert!(kinds.contains(&RepairFindingKind::TemporaryMemoryMode));
    assert!(kinds.contains(&RepairFindingKind::ChunkContinuation));
}

fn scan_row(
    table_name: &str,
    resource_id: &str,
    target_state: RepairTargetState,
    protected: bool,
    known_owner: bool,
) -> RepairScanRow {
    RepairScanRow {
        table_name: table_name.to_owned(),
        resource_id: resource_id.to_owned(),
        ledger_state: RepairTargetState::Present,
        target_state,
        protected,
        known_owner,
        decode_ok: true,
        corrupt: false,
    }
}

fn backfill_plan(
    table_name: &str,
    resource_id: &str,
    protected: bool,
    known_owner: bool,
) -> RepairBackfillPlan {
    RepairBackfillPlan {
        table_name: table_name.to_owned(),
        resource_id: resource_id.to_owned(),
        target_state: RepairTargetState::Missing,
        protected,
        known_owner,
    }
}
