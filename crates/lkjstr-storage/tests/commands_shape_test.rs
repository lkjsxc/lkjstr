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
        if command.statements.is_empty()
            && command.protection_policy != StorageProtectionPolicy::InventoryOnly
        {
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
            && command.operation == StorageOperation::Compaction
        {
            return Err(format!("{} prunes protected rows", command.id));
        }
        if command.stats_projection != StorageStatsProjection::None
            && command.stats_projection.as_str() == "none"
        {
            return Err(format!("{} has an invalid Stats projection", command.id));
        }
    }
    Ok(())
}

#[test]
fn commands_have_stable_shape_and_documentation() -> Result<(), String> {
    let docs = command_matrix_docs()?;
    for command in storage_repository_commands() {
        if command.input_type.trim().is_empty() || command.output_type.trim().is_empty() {
            return Err(format!("{} has an empty type label", command.id));
        }
        if !stable_id(command.id) {
            return Err(format!("{} is not a stable dotted id", command.id));
        }
        if !docs.contains(&format!("`{}`", command.id)) {
            return Err(format!("{} is missing from command docs", command.id));
        }
    }
    Ok(())
}

fn command_matrix_docs() -> Result<String, String> {
    let root = env!("CARGO_MANIFEST_DIR");
    let dir = format!("{root}/../../docs/architecture/data/storage/kernel/commands");
    let mut text = String::new();
    for file in [
        "protected.md",
        "event-cache.md",
        "feed-evidence.md",
        "diagnostics.md",
        "retention.md",
        "repair.md",
    ] {
        text.push_str(
            &std::fs::read_to_string(format!("{dir}/{file}"))
                .map_err(|error| format!("{file}: {error}"))?,
        );
    }
    Ok(text)
}

fn stable_id(id: &str) -> bool {
    id.contains('.')
        && id.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'.'
        })
}

fn is_decode_kind(kind: StorageProblemKind) -> bool {
    matches!(
        kind,
        StorageProblemKind::ActiveAccountSelectorDecodeFailed
            | StorageProblemKind::PressureSnapshotDecodeFailed
            | StorageProblemKind::OptimizerRecordDecodeFailed
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
