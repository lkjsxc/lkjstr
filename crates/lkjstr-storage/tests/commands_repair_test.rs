use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn repair_commands_are_registered_with_stable_metadata() -> Result<(), String> {
    let scan = command("repair.scan-ledger")?;
    assert_eq!(scan.family, StorageCommandFamily::Repair);
    assert_eq!(scan.operation, StorageOperation::Repair);
    assert_eq!(scan.ledger_policy, StorageLedgerPolicy::RepairsLedger);
    assert_eq!(scan.protection_policy, StorageProtectionPolicy::Mixed);
    assert_eq!(scan.stats_projection, StorageStatsProjection::CacheSummary);
    assert!(scan.statements.contains(&"cache_ledger.select"));
    assert!(scan.tables.contains(&"cache_ledger"));
    assert!(scan.tables.contains(&"events"));

    let backfill = command("repair.backfill-ledger")?;
    assert_eq!(backfill.ledger_policy, StorageLedgerPolicy::RepairsLedger);
    assert!(backfill.statements.contains(&"cache_ledger.upsert"));
    assert!(backfill.row_codecs.contains(&"repair_backfill_plan"));

    let probe = command("repair.probe-targets")?;
    assert_eq!(probe.ledger_policy, StorageLedgerPolicy::RepairsLedger);
    assert!(probe.statements.contains(&"events.repair_probe"));
    assert!(probe.statements.contains(&"jobs.repair_probe"));
    assert!(probe.row_codecs.contains(&"repair_probe_hit"));

    let inventory = command("repair.report-inventory")?;
    assert_eq!(
        inventory.protection_policy,
        StorageProtectionPolicy::InventoryOnly
    );
    assert_eq!(
        inventory.stats_projection,
        StorageStatsProjection::Inventory
    );
    assert!(inventory.statements.is_empty());
    Ok(())
}

#[test]
fn repair_commands_name_repair_problem_kinds() -> Result<(), String> {
    let scan = command("repair.scan-ledger")?;
    for kind in [
        StorageProblemKind::RepairSchemaMismatch,
        StorageProblemKind::RepairCorruptRow,
        StorageProblemKind::RepairDecodeFailure,
        StorageProblemKind::RepairOrphanLedgerRow,
        StorageProblemKind::RepairOrphanResourceRow,
        StorageProblemKind::RepairIncompleteInventory,
        StorageProblemKind::RepairTemporaryMemoryMode,
        StorageProblemKind::RepairUnknownUnownedRow,
        StorageProblemKind::RepairSkippedUnknownRow,
        StorageProblemKind::RepairBackfillPlanned,
        StorageProblemKind::RepairBackfillApplied,
        StorageProblemKind::RepairChunkContinuation,
    ] {
        assert!(scan.problem_kinds.contains(&kind), "missing {kind:?}");
        assert!(kind.as_str().starts_with("repair-"));
    }
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
