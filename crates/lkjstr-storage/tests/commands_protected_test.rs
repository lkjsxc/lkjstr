use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn active_selector_commands_are_protected_settings_commands() -> Result<(), String> {
    let get = command("active-account-selector.get")?;
    assert_eq!(get.family, StorageCommandFamily::ActiveSelector);
    assert_eq!(get.operation, StorageOperation::Read);
    assert_eq!(get.input_type, "ActiveAccountSelectorGetInput");
    assert_eq!(get.output_type, "ActiveAccountSelectorGetOutput");
    assert_eq!(get.statements, &["settings.select"]);
    assert_eq!(get.tables, &["settings"]);
    assert_eq!(get.row_codecs, &["active_account_selector_from_sqlite_row"]);
    assert_eq!(
        get.problem_kinds,
        &[StorageProblemKind::ActiveAccountSelectorDecodeFailed]
    );
    assert_eq!(get.ledger_policy, StorageLedgerPolicy::None);
    assert_eq!(get.protection_policy, StorageProtectionPolicy::Protected);
    assert_eq!(get.stats_projection, StorageStatsProjection::None);

    let put = command("active-account-selector.put")?;
    assert_eq!(put.statements, &["settings.upsert"]);
    assert_eq!(put.row_codecs, &["sqlite_active_account_selector_row"]);
    assert!(
        put.problem_kinds
            .contains(&StorageProblemKind::QuotaOrWriteFailed)
    );
    assert_eq!(put.protection_policy, StorageProtectionPolicy::Protected);

    let delete = command("active-account-selector.delete")?;
    assert_eq!(delete.operation, StorageOperation::Write);
    assert_eq!(delete.statements, &["settings.delete"]);
    assert!(delete.row_codecs.is_empty());
    assert_eq!(delete.protection_policy, StorageProtectionPolicy::Protected);
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
