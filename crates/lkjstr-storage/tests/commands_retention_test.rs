use lkjstr_storage::{
    StorageCommandFamily, StorageDataClass, StorageLedgerPolicy, StorageOperation,
    StorageProblemKind, StorageProtectionPolicy, StorageStatsProjection, sqlite_schema_table,
    sqlite_statement, storage_repository_commands,
};

const STOP_PROBLEMS: &[StorageProblemKind] = &[
    StorageProblemKind::PressureNoPrunableCandidates,
    StorageProblemKind::PressureProtectedOnly,
    StorageProblemKind::PressureUnknownUsage,
    StorageProblemKind::PressureInventoryIncomplete,
    StorageProblemKind::PressureQuota,
    StorageProblemKind::PressureStorageApiUnavailable,
    StorageProblemKind::PressureCompactionError,
];

#[test]
fn retention_commands_are_registered() -> Result<(), String> {
    assert_eq!(
        command("retention.plan")?.family,
        StorageCommandFamily::Retention
    );
    assert_eq!(
        command("retention.delete-dispatch")?.family,
        StorageCommandFamily::Retention
    );
    Ok(())
}

#[test]
fn retention_commands_reference_known_statements_and_tables() -> Result<(), String> {
    for id in ["retention.plan", "retention.delete-dispatch"] {
        let spec = command(id)?;
        for statement in spec.statements {
            if sqlite_statement(statement).is_none() {
                return Err(format!("{id} missing statement {statement}"));
            }
        }
        for table in spec.tables {
            if sqlite_schema_table(table).is_none() {
                return Err(format!("{id} missing table {table}"));
            }
        }
    }
    Ok(())
}

#[test]
fn retention_plan_reads_ledger_and_projects_pressure() -> Result<(), String> {
    let plan = command("retention.plan")?;
    assert_eq!(plan.operation, StorageOperation::Compaction);
    assert_eq!(plan.input_type, "RetentionPlanInput");
    assert_eq!(plan.output_type, "RetentionPlanOutput");
    assert_eq!(plan.statements, &["cache_ledger.compaction_candidates"]);
    assert_eq!(plan.tables, &["cache_ledger"]);
    assert_eq!(plan.ledger_policy, StorageLedgerPolicy::ReadsLedger);
    assert_eq!(plan.protection_policy, StorageProtectionPolicy::Mixed);
    assert_eq!(plan.stats_projection, StorageStatsProjection::Pressure);
    assert!(plan.data_classes.contains(&StorageDataClass::Ledger));
    Ok(())
}

#[test]
fn retention_delete_dispatch_deletes_ledger_backed_rows() -> Result<(), String> {
    let delete = command("retention.delete-dispatch")?;
    assert_eq!(delete.operation, StorageOperation::Compaction);
    assert_eq!(
        delete.ledger_policy,
        StorageLedgerPolicy::DeletesLedgerBackedRows
    );
    assert_eq!(delete.protection_policy, StorageProtectionPolicy::Mixed);
    assert!(delete.statements.contains(&"cache_ledger.delete"));
    assert!(delete.statements.contains(&"events.delete"));
    assert!(delete.tables.contains(&"cache_ledger"));
    assert!(
        delete
            .data_classes
            .contains(&StorageDataClass::RecoverableCache)
    );
    Ok(())
}

#[test]
fn retention_commands_declare_pressure_stop_problem_kinds() -> Result<(), String> {
    for id in ["retention.plan", "retention.delete-dispatch"] {
        let spec = command(id)?;
        for kind in STOP_PROBLEMS {
            if !spec.problem_kinds.contains(kind) {
                return Err(format!("{id} missing problem kind {}", kind.as_str()));
            }
        }
        assert!(
            spec.problem_kinds
                .contains(&StorageProblemKind::QuotaOrWriteFailed)
        );
    }
    Ok(())
}

#[test]
fn retention_delete_dispatch_does_not_include_protected_tables() -> Result<(), String> {
    let delete = command("retention.delete-dispatch")?;
    for table in [
        "accounts",
        "local_account_secrets",
        "settings",
        "relay_sets",
        "workspaces",
        "tweet_drafts",
        "tab_states",
        "relay_route_blocks",
    ] {
        if delete.tables.contains(&table) {
            return Err(format!("delete dispatch includes protected table {table}"));
        }
    }
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
