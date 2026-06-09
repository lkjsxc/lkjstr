use std::collections::HashSet;

use lkjstr_storage::{
    StorageLedgerPolicy, StorageOperation, StorageProblemKind, StorageProtectionPolicy,
    StorageRepositoryCommandSpec, StorageStatsProjection, sqlite_schema_table, sqlite_statement,
    storage_repository_commands,
};

#[test]
fn command_ids_are_unique() -> Result<(), String> {
    let mut ids = HashSet::new();
    for command in storage_repository_commands() {
        if !ids.insert(command.id) {
            return Err(format!("duplicate command id {}", command.id));
        }
    }
    Ok(())
}

#[test]
fn commands_name_existing_statements_and_tables() -> Result<(), String> {
    for command in storage_repository_commands() {
        if command.statements.is_empty() {
            return Err(format!("{} has no statement ids", command.id));
        }
        for statement in command.statements {
            if sqlite_statement(statement).is_none() {
                return Err(format!("{} uses missing statement {statement}", command.id));
            }
        }
        if command.protection_policy != StorageProtectionPolicy::InventoryOnly
            && command.tables.is_empty()
        {
            return Err(format!("{} has no table names", command.id));
        }
        for table in command.tables {
            if sqlite_schema_table(table).is_none() {
                return Err(format!("{} uses missing table {table}", command.id));
            }
        }
    }
    Ok(())
}

#[test]
fn commands_have_specific_codecs_and_problem_kinds() -> Result<(), String> {
    for command in storage_repository_commands() {
        for codec in command.row_codecs {
            if codec.trim().is_empty() {
                return Err(format!("{} has an empty row codec", command.id));
            }
        }
        for kind in command.problem_kinds {
            if *kind == StorageProblemKind::Corrupt {
                return Err(format!("{} uses generic corrupt", command.id));
            }
        }
        if command.operation == StorageOperation::Read
            && !command.row_codecs.is_empty()
            && !command
                .problem_kinds
                .iter()
                .any(|kind| is_decode_kind(*kind))
        {
            return Err(format!("{} lacks a decode problem kind", command.id));
        }
        if is_write(command)
            && !command
                .problem_kinds
                .iter()
                .any(|kind| is_write_kind(*kind))
        {
            return Err(format!("{} lacks a write problem kind", command.id));
        }
    }
    Ok(())
}

#[test]
fn commands_declare_ledger_protection_and_stats_policies() -> Result<(), String> {
    for command in storage_repository_commands() {
        if command.statements.contains(&"cache_ledger.upsert")
            && command.ledger_policy != StorageLedgerPolicy::ResourceAndLedgerSameBatch
        {
            return Err(format!("{} does not declare same-batch ledger", command.id));
        }
        if command.protection_policy == StorageProtectionPolicy::Protected
            && command.ledger_policy == StorageLedgerPolicy::DeletesLedgerBackedRows
        {
            return Err(format!("{} deletes protected ledger rows", command.id));
        }
        if command.stats_projection != StorageStatsProjection::None
            && command.stats_projection.as_str() == "none"
        {
            return Err(format!("{} has an invalid Stats projection", command.id));
        }
    }
    Ok(())
}

fn is_decode_kind(kind: StorageProblemKind) -> bool {
    matches!(
        kind,
        StorageProblemKind::ActiveAccountSelectorDecodeFailed
            | StorageProblemKind::PressureSnapshotDecodeFailed
            | StorageProblemKind::ProtectedRecordDecodeFailed
            | StorageProblemKind::CacheRecordDecodeFailed
    )
}

fn is_write(command: &StorageRepositoryCommandSpec) -> bool {
    matches!(
        command.operation,
        StorageOperation::Write | StorageOperation::Transaction | StorageOperation::Compaction
    )
}

fn is_write_kind(kind: StorageProblemKind) -> bool {
    matches!(
        kind,
        StorageProblemKind::QuotaOrWriteFailed
            | StorageProblemKind::PressureSnapshotDecodeFailed
            | StorageProblemKind::ActiveAccountSelectorDecodeFailed
    )
}
