use lkjstr_storage::{
    StorageDataClass, StorageOperation, StorageProblemKind, storage_repository_commands,
};

#[test]
fn active_selector_commands_are_protected_settings_commands() -> Result<(), String> {
    let get = command("active-account-selector.get")?;
    assert_eq!(get.table, "settings");
    assert_eq!(get.input_type, "ActiveAccountSelectorGetInput");
    assert_eq!(get.output_type, "ActiveAccountSelectorGetOutput");
    assert_eq!(get.operation, StorageOperation::Read);
    assert_eq!(
        get.problem_kind,
        StorageProblemKind::ActiveAccountSelectorDecodeFailed
    );
    assert_eq!(get.data_class, StorageDataClass::ProtectedUserData);
    assert!(get.protected);
    assert!(!get.prunable);
    Ok(())
}

#[test]
fn pressure_commands_project_exact_stats_state() -> Result<(), String> {
    let get = command("storage-pressure.get")?;
    assert_eq!(get.table, "cacheMeta");
    assert_eq!(get.row_codec, "storage_pressure_from_sqlite_row");
    assert_eq!(
        get.problem_kind,
        StorageProblemKind::PressureSnapshotDecodeFailed
    );
    assert_eq!(get.stats_projection, "pressure-health");

    let project = command("storage-pressure.project-stats")?;
    assert_eq!(project.operation, StorageOperation::Inventory);
    assert_eq!(project.output_type, "StoragePressureProjectOutput");
    assert!(!project.protected);
    assert!(!project.prunable);
    Ok(())
}

fn command(name: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.name == name)
        .ok_or_else(|| format!("missing command {name}"))
}
