#![doc = "Rust storage contracts for lkjstr."]

pub mod accounts;
pub mod data_class;
pub mod ledger;
pub mod local_secrets;
pub mod manifest;
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

pub use accounts::{AccountRecord, account_record_id, account_record_json_bytes};
pub use data_class::{StorageDataClass, StorageInventoryGroup};
pub use ledger::{
    LedgerResourceSpec, direct_ledger_resource_specs, ledger_resource_kinds, ledger_resource_spec,
    ledger_resource_specs,
};
pub use local_secrets::{
    LocalAccountSecretRecord, local_secret_record_json_bytes, local_secret_record_key,
};
pub use manifest::{
    StorageTableSpec, is_storage_table_name, storage_manifest_group, storage_table_names,
    storage_table_spec, storage_table_specs,
};
pub use outcome::{StorageOperation, StorageOutcome, StorageProblem};
pub use relay_sets::{RelaySetRecord, relay_set_record_id, relay_set_record_json_bytes};
pub use resource::{CacheOwnerKind, CacheResourceKind};
pub use settings::{SettingOverrideRecord, setting_record_json_bytes, setting_record_key};
pub use settings_schema::{
    SettingRecord, SettingValueType, default_setting_records, merge_setting_overrides,
    setting_override_for_value,
};
pub use sql::{
    FOREIGN_KEYS_PRAGMA, SqliteIndexSpec, SqliteRetentionClass, SqliteSchemaStatement,
    SqliteStatementKind, SqliteTableSpec, sqlite_schema_index_names, sqlite_schema_indexes,
    sqlite_schema_statements, sqlite_schema_table, sqlite_schema_table_names, sqlite_schema_tables,
};
pub use stats::{StorageInventoryRow, StorageStatsSnapshot, StorageTableCount};
pub use tab_state::{
    CacheLedgerRecord, TabStateRecord, cache_ledger_id, encoded_json_bytes, tab_state_id,
    tab_state_ledger_record,
};
pub use tweet_drafts::{TweetDraftRecord, tweet_draft_record_id, tweet_draft_record_json_bytes};
pub use workspace::{WorkspaceRecord, workspace_record_id, workspace_record_json_bytes};

/// Crate ownership marker used by repository checks and docs.
pub const CRATE_OWNER: &str = "storage";

/// IndexedDB schema step shared with the current browser storage manifest.
pub const CURRENT_STORAGE_SCHEMA_STEP: u32 = 18;
