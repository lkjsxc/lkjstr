use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn pressure_commands_project_exact_stats_state() -> Result<(), String> {
    let get = command("storage-pressure.get")?;
    assert_eq!(get.family, StorageCommandFamily::Pressure);
    assert_eq!(get.operation, StorageOperation::Read);
    assert_eq!(get.statements, &["cache_meta.select"]);
    assert_eq!(get.tables, &["cache_meta"]);
    assert_eq!(get.row_codecs, &["storage_pressure_from_sqlite_row"]);
    assert_eq!(
        get.problem_kinds,
        &[StorageProblemKind::PressureSnapshotDecodeFailed]
    );
    assert_eq!(
        get.protection_policy,
        StorageProtectionPolicy::RecoverableDiagnostics
    );
    assert_eq!(get.stats_projection, StorageStatsProjection::Pressure);

    let put = command("storage-pressure.put")?;
    assert_eq!(put.operation, StorageOperation::Write);
    assert_eq!(put.statements, &["cache_meta.upsert"]);
    assert_eq!(put.row_codecs, &["sqlite_storage_pressure_snapshot_row"]);
    assert!(
        put.problem_kinds
            .contains(&StorageProblemKind::QuotaOrWriteFailed)
    );

    let project = command("storage-pressure.project-stats")?;
    assert_eq!(project.operation, StorageOperation::Inventory);
    assert_eq!(project.output_type, "StoragePressureProjectOutput");
    assert_eq!(project.stats_projection, StorageStatsProjection::Pressure);
    Ok(())
}

#[test]
fn commands_diagnostics_writes_are_ledger_backed() -> Result<(), String> {
    for id in [
        "relay-diagnostics.information.put",
        "relay-diagnostics.summary.put",
        "relay-diagnostics.suggestions.put",
        "relay-diagnostics.author-routes.put",
        "relay-diagnostics.notifications.put",
        "jobs.put",
    ] {
        let command = command(id)?;
        assert_eq!(command.operation, StorageOperation::Transaction);
        assert!(command.statements.contains(&"cache_ledger.upsert"));
        assert_eq!(
            command.ledger_policy,
            StorageLedgerPolicy::ResourceAndLedgerSameBatch
        );
        assert!(
            command
                .problem_kinds
                .contains(&StorageProblemKind::QuotaOrWriteFailed)
        );
    }
    Ok(())
}

#[test]
fn commands_diagnostics_route_blocks_are_protected_not_ledger_backed() -> Result<(), String> {
    for id in [
        "relay-diagnostics.route-block.put",
        "relay-diagnostics.route-block.delete",
        "relay-diagnostics.route-block.recent",
    ] {
        let command = command(id)?;
        assert_eq!(command.family, StorageCommandFamily::RelayDiagnostics);
        assert_eq!(
            command.protection_policy,
            StorageProtectionPolicy::Protected
        );
        assert_eq!(command.ledger_policy, StorageLedgerPolicy::None);
    }
    Ok(())
}

#[test]
fn commands_diagnostics_app_log_and_inventory_project_stats() -> Result<(), String> {
    for id in ["app-log.insert", "app-log.recent", "app-log.clear-before"] {
        assert_eq!(
            command(id)?.stats_projection,
            StorageStatsProjection::AppLog
        );
    }
    let inventory = command("storage-inventory.snapshot")?;
    assert_eq!(inventory.family, StorageCommandFamily::Inventory);
    assert_eq!(inventory.operation, StorageOperation::Inventory);
    assert_eq!(
        inventory.protection_policy,
        StorageProtectionPolicy::InventoryOnly
    );
    assert!(inventory.statements.is_empty());
    assert_eq!(
        inventory.stats_projection,
        StorageStatsProjection::Inventory
    );
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
