#![doc = "Rust storage contracts for lkjstr."]

pub mod accounts;
pub mod data_class;
pub mod events;
pub mod feed_cache;
mod feed_cache_ledger;
pub mod ledger;
pub mod local_secrets;
pub mod manifest;
pub mod notifications;
pub mod outcome;
pub mod relay_sets;
pub mod resource;
pub mod settings;
mod settings_defs;
pub mod settings_schema;
pub mod sql;
pub mod stats;
pub mod tab_state;
mod table_specs;
pub mod tweet_drafts;
pub mod workspace;

pub use accounts::{
    AccountRecord, SqliteAccountRow, account_from_sqlite_row, account_record_id,
    account_record_json_bytes, account_sqlite_key, signer_kind, sqlite_account_row,
};
pub use data_class::{StorageDataClass, StorageInventoryGroup};
pub use events::{
    SqliteEventRelayRow, SqliteEventRow, SqliteEventTagRow, StoredEventRecord, event_cache_bytes,
    event_cache_ledger_record, event_from_sqlite_row, sqlite_event_relay_row, sqlite_event_row,
    sqlite_event_tag_rows,
};
pub use feed_cache::{
    FeedCoverageRecord, FeedCursorRecord, FeedScanHintRecord, SqliteFeedCoverageRow,
    SqliteFeedCursorRow, SqliteFeedScanHintRow, feed_coverage_from_sqlite_row,
    sqlite_feed_coverage_row, sqlite_feed_cursor_row, sqlite_feed_scan_hint_row,
};
pub use feed_cache_ledger::{
    feed_coverage_ledger_record, feed_cursor_ledger_record, feed_scan_hint_ledger_record,
};
pub use ledger::{
    LedgerResourceSpec, direct_ledger_resource_specs, ledger_resource_kinds, ledger_resource_spec,
    ledger_resource_specs,
};
pub use local_secrets::{
    LocalAccountSecretRecord, SqliteLocalSecretRow, local_secret_from_sqlite_row,
    local_secret_record_json_bytes, local_secret_record_key, local_secret_sqlite_key,
    sqlite_local_secret_row,
};
pub use manifest::{
    StorageTableSpec, is_storage_table_name, storage_manifest_group, storage_table_names,
    storage_table_spec, storage_table_specs,
};
pub use notifications::{
    NotificationRecord, SqliteNotificationRow, notification_ledger_record, sqlite_notification_row,
};
pub use outcome::{StorageOperation, StorageOutcome, StorageProblem};
pub use relay_sets::{
    RelaySetRecord, SqliteRelaySetRow, relay_set_from_sqlite_row, relay_set_record_id,
    relay_set_record_json_bytes, sqlite_relay_set_row,
};
pub use resource::{CacheOwnerKind, CacheResourceKind};
pub use settings::{
    SettingOverrideRecord, SqliteSettingRow, setting_from_sqlite_row, setting_namespace,
    setting_record_json_bytes, setting_record_key, sqlite_setting_row,
};
pub use settings_schema::{
    SettingRecord, SettingValueType, default_setting_records, merge_setting_overrides,
    setting_override_for_value,
};
pub use sql::{
    FOREIGN_KEYS_PRAGMA, SqliteIndexSpec, SqliteRetentionClass, SqliteSchemaStatement,
    SqliteStatementKind, SqliteStatementSpec, SqliteTableSpec, cache_sqlite_statements,
    protected_sqlite_statement, protected_sqlite_statements, sqlite_repository_statements,
    sqlite_schema_hash, sqlite_schema_index_names, sqlite_schema_indexes, sqlite_schema_statements,
    sqlite_schema_table, sqlite_schema_table_names, sqlite_schema_tables, sqlite_statement,
};
pub use stats::{StorageInventoryRow, StorageStatsSnapshot, StorageTableCount};
pub use tab_state::{
    CacheLedgerRecord, SqliteCacheLedgerRow, SqliteTabStateRow, TabStateRecord, cache_ledger_id,
    encoded_json_bytes, sqlite_cache_ledger_row, sqlite_cache_ledger_row_for_table,
    sqlite_tab_state_row, tab_state_from_sqlite_row, tab_state_id, tab_state_ledger_record,
};
pub use tweet_drafts::{
    SqliteTweetDraftRow, TweetDraftRecord, sqlite_tweet_draft_row, tweet_draft_from_sqlite_row,
    tweet_draft_record_id, tweet_draft_record_json_bytes,
};
pub use workspace::{
    SqliteWorkspaceRow, WorkspaceRecord, sqlite_workspace_row, workspace_from_sqlite_row,
    workspace_record_id, workspace_record_json_bytes,
};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "storage";

/// IndexedDB schema step shared with the current browser storage manifest.
pub const CURRENT_STORAGE_SCHEMA_STEP: u32 = 18;
