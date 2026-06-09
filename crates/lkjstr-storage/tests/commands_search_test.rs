use lkjstr_storage::{
    StorageCommandFamily, StorageLedgerPolicy, StorageOperation, StorageProtectionPolicy,
    StorageStatsProjection,
    commands::search::{
        SEARCH_LOCAL_QUERY_COMMAND, SEARCH_UPDATE_EVENT_INDEX_COMMAND, TAG_LOOKUP_BY_VALUE_COMMAND,
    },
};

#[test]
fn search_commands_are_registered_with_stable_metadata() {
    assert_eq!(
        TAG_LOOKUP_BY_VALUE_COMMAND.family,
        StorageCommandFamily::SearchIndex
    );
    assert_eq!(
        TAG_LOOKUP_BY_VALUE_COMMAND.operation,
        StorageOperation::Read
    );
    assert!(
        TAG_LOOKUP_BY_VALUE_COMMAND
            .statements
            .contains(&"events.by_tag_value")
    );

    assert_eq!(
        SEARCH_UPDATE_EVENT_INDEX_COMMAND.operation,
        StorageOperation::Transaction
    );
    assert_eq!(
        SEARCH_UPDATE_EVENT_INDEX_COMMAND.statements,
        &[
            "event_search_tokens.delete_by_event",
            "event_search_tokens.upsert"
        ]
    );
    assert_eq!(
        SEARCH_UPDATE_EVENT_INDEX_COMMAND.ledger_policy,
        StorageLedgerPolicy::None
    );
    assert_eq!(
        SEARCH_UPDATE_EVENT_INDEX_COMMAND.protection_policy,
        StorageProtectionPolicy::RecoverableCache
    );
}

#[test]
fn local_search_metadata_uses_indexed_rows() {
    assert_eq!(SEARCH_LOCAL_QUERY_COMMAND.operation, StorageOperation::Read);
    assert!(
        SEARCH_LOCAL_QUERY_COMMAND
            .statements
            .contains(&"event_search_tokens.by_token")
    );
    assert!(
        !SEARCH_LOCAL_QUERY_COMMAND
            .statements
            .contains(&"events.by_kind_time")
    );
    assert_eq!(
        SEARCH_LOCAL_QUERY_COMMAND.stats_projection,
        StorageStatsProjection::None
    );
}
