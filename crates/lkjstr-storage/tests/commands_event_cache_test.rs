use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProblemKind,
    StorageProtectionPolicy, StorageStatsProjection, storage_repository_commands,
};

#[test]
fn commands_event_cache_put_is_same_batch_resource_and_ledger() -> Result<(), String> {
    let put = command("event-cache.event.put")?;
    assert_eq!(put.family, StorageCommandFamily::EventCache);
    assert_eq!(put.operation, StorageOperation::Transaction);
    assert_eq!(put.input_type, "EventPutInput");
    assert_eq!(put.output_type, "EventPutOutput");
    assert_eq!(
        put.statements,
        &[
            "events.upsert",
            "event_tags.delete_by_event",
            "event_tags.upsert",
            "event_relays.upsert",
            "cache_ledger.upsert",
        ]
    );
    assert_eq!(
        put.tables,
        &["events", "event_tags", "event_relays", "cache_ledger"]
    );
    assert_eq!(
        put.ledger_policy,
        StorageLedgerPolicy::ResourceAndLedgerSameBatch
    );
    assert_eq!(
        put.protection_policy,
        StorageProtectionPolicy::RecoverableCache
    );
    assert_eq!(put.stats_projection, StorageStatsProjection::CacheSummary);
    assert!(
        put.problem_kinds
            .contains(&StorageProblemKind::QuotaOrWriteFailed)
    );
    Ok(())
}

#[test]
fn commands_event_cache_reads_are_recoverable_cache_reads() -> Result<(), String> {
    for id in [
        "event-cache.event.get",
        "event-cache.event-relays",
        "event-cache.events-by-tag-value",
        "event-cache.events-by-kind",
        "event-cache.events-by-author-kind",
    ] {
        let command = command(id)?;
        assert_eq!(command.family, StorageCommandFamily::EventCache);
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
    }
    Ok(())
}

fn command(id: &str) -> Result<&'static lkjstr_storage::StorageRepositoryCommandSpec, String> {
    storage_repository_commands()
        .iter()
        .find(|command| command.id == id)
        .ok_or_else(|| format!("missing command {id}"))
}
