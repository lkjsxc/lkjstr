use lkjstr_storage::{
    StorageCommandFamily, StorageOperation, StorageProblemKind, StorageProtectionPolicy,
    StorageStatsProjection, storage_repository_commands,
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

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
