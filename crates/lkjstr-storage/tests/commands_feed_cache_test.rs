use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn commands_feed_cache_writes_are_same_batch_resource_and_ledger() -> Result<(), String> {
    for id in [
        "feed-evidence.cursor.put",
        "feed-evidence.coverage.put",
        "feed-evidence.scan-hint.put",
    ] {
        let command = command(id)?;
        assert_eq!(command.family, StorageCommandFamily::FeedEvidence);
        assert_eq!(command.operation, StorageOperation::Transaction);
        assert!(command.statements.contains(&"cache_ledger.upsert"));
        assert_eq!(
            command.ledger_policy,
            StorageLedgerPolicy::ResourceAndLedgerSameBatch
        );
        assert_eq!(
            command.protection_policy,
            StorageProtectionPolicy::RecoverableCache
        );
        assert_eq!(
            command.stats_projection,
            StorageStatsProjection::CacheSummary
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
fn commands_feed_cache_reads_keep_evidence_rows_recoverable() -> Result<(), String> {
    for id in [
        "feed-evidence.cursor.get",
        "feed-evidence.coverage.for-feed",
        "feed-evidence.scan-hints.for-feed",
    ] {
        let command = command(id)?;
        assert_eq!(command.family, StorageCommandFamily::FeedEvidence);
        assert_eq!(command.operation, StorageOperation::Read);
        assert_eq!(
            command.protection_policy,
            StorageProtectionPolicy::RecoverableCache
        );
        assert!(
            command
                .problem_kinds
                .contains(&StorageProblemKind::CacheRecordDecodeFailed)
        );
        assert_eq!(command.stats_projection, StorageStatsProjection::None);
    }
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
