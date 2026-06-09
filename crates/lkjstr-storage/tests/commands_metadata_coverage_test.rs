use lkjstr_storage::{
    SqliteRetentionClass, StorageLedgerPolicy, StorageOperation, StorageProtectionPolicy,
    StorageStatsProjection, sqlite_schema_table, sqlite_statement, storage_repository_commands,
};

#[test]
fn commands_statement_tables_are_declared() -> Result<(), String> {
    for command in storage_repository_commands() {
        for statement_id in command.statements {
            let statement = sqlite_statement(statement_id)
                .ok_or_else(|| format!("{} missing statement {statement_id}", command.id))?;
            if !command.tables.contains(&statement.table_name) {
                return Err(format!(
                    "{} omits statement table {}",
                    command.id, statement.table_name
                ));
            }
        }
    }
    Ok(())
}

#[test]
fn commands_ledger_policies_match_ledger_statements() -> Result<(), String> {
    for command in storage_repository_commands() {
        let upserts_ledger = command.statements.contains(&"cache_ledger.upsert");
        let deletes_ledger = command.statements.contains(&"cache_ledger.delete");
        let reads_ledger = command
            .statements
            .iter()
            .any(|item| item.starts_with("cache_ledger.") && !item.ends_with("upsert"));
        match command.ledger_policy {
            StorageLedgerPolicy::None => {
                if upserts_ledger || deletes_ledger {
                    return Err(format!("{} has ledger SQL without policy", command.id));
                }
            }
            StorageLedgerPolicy::ResourceAndLedgerSameBatch => {
                if !upserts_ledger || command.operation != StorageOperation::Transaction {
                    return Err(format!("{} lacks same-batch ledger write", command.id));
                }
            }
            StorageLedgerPolicy::DeletesLedgerBackedRows => {
                if !deletes_ledger {
                    return Err(format!("{} lacks ledger delete", command.id));
                }
            }
            StorageLedgerPolicy::ReadsLedger => {
                if !reads_ledger {
                    return Err(format!("{} lacks ledger read", command.id));
                }
            }
            StorageLedgerPolicy::RepairsLedger => {}
        }
    }
    Ok(())
}

#[test]
fn commands_touching_protected_tables_use_protected_policy() -> Result<(), String> {
    for command in storage_repository_commands() {
        for table_name in command.tables {
            let table = sqlite_schema_table(table_name)
                .ok_or_else(|| format!("{} missing table {table_name}", command.id))?;
            if table.retention == SqliteRetentionClass::Protected
                && command.protection_policy != StorageProtectionPolicy::Protected
            {
                return Err(format!("{} touches protected table {table_name}", command.id));
            }
        }
    }
    Ok(())
}

#[test]
fn commands_stats_projection_metadata_is_documented() -> Result<(), String> {
    let docs = command_matrix_docs()?;
    for command in storage_repository_commands() {
        if command.stats_projection == StorageStatsProjection::None {
            continue;
        }
        let needle = format!("| `{}`", command.id);
        let row = docs
            .lines()
            .find(|line| line.contains(&needle))
            .ok_or_else(|| format!("{} missing from command docs", command.id))?;
        if !row.contains(command.stats_projection.as_str()) {
            return Err(format!("{} omits documented Stats projection", command.id));
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
