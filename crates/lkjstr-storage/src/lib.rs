#![doc = "Rust storage contracts for lkjstr."]

pub mod accounts;
pub mod active_account;
pub mod app_log;
pub mod data_class;
pub mod diagnostics;
pub mod events;
pub mod feed_cache;
mod feed_cache_ledger;
pub mod jobs;
pub mod ledger;
pub mod local_secrets;
pub mod manifest;
pub mod notifications;
pub mod optimizer;
pub mod outcome;
pub mod pressure;
pub mod relay_sets;
pub mod resource;
pub mod route_blocks;
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
pub use active_account::{
    ACTIVE_ACCOUNT_SELECTOR_KEY, ACTIVE_ACCOUNT_SELECTOR_SCOPE, ActiveAccountSelectorRecord,
    SqliteActiveAccountSelectorRow, active_account_selector_from_sqlite_row,
    active_account_selector_json_bytes, active_account_selector_key,
    sqlite_active_account_selector_row,
};
pub use app_log::{AppLogRecord, SqliteAppLogRow, redact_app_log_text};
pub use data_class::{StorageDataClass, StorageInventoryGroup};
pub use diagnostics::{
    AuthorRelayRouteRecord, RelayDiagnosticSummaryRecord, RelayInformationRecord,
    RelayListSuggestionRecord, SqliteAuthorRelayRouteRow, SqliteRelayDiagnosticSummaryRow,
    SqliteRelayInformationRow, SqliteRelayListSuggestionRow, author_route_ledger_record,
    relay_info_ledger_record, relay_suggestion_ledger_record, relay_summary_ledger_record,
};
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
pub use jobs::{JobRecord, SqliteJobRow, job_ledger_record};
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
pub use optimizer::{
    DEFAULT_OBSERVATION_MAX_AGE_MS, DEFAULT_OBSERVATION_MAX_ROWS,
    DEFAULT_OPTIMIZER_SCORE_MAX_AGE_MS, DEFAULT_ROUTE_EVIDENCE_MAX_AGE_MS,
    DEFAULT_SCAN_HINT_MAX_AGE_MS, OPTIMIZER_REPOSITORY_STATEMENTS, OPTIMIZER_TABLES,
    OptimizerKeyProblem, OptimizerLedgerProbe, OptimizerRepositoryStatement,
    OptimizerRetentionPlan, OptimizerRetentionPolicy, OptimizerScanHintRecord,
    RelayReadObservationRecord, RelayReadScoreRecord, RouteEvidenceScoreRecord,
    SCAN_MODEL_REPOSITORY_STATEMENTS, SCAN_MODEL_TABLES, ScanDecisionTraceRecord,
    ScanDensityModelRecord, ScanModelContextRecord, ScanModelKeyRecord, ScanObservationRecord,
    SqliteOptimizerScanHintRow, SqliteRelayReadObservationRow, SqliteRelayReadScoreRow,
    SqliteRouteEvidenceScoreRow, SqliteScanDecisionTraceRow, SqliteScanDensityModelRow,
    SqliteScanObservationRow, StoredScanModelScope, decayed_scan_model_confidence,
    optimizer_inventory_tables, optimizer_repository_statements, optimizer_resource_kind,
    optimizer_scan_hint_from_sqlite_row, optimizer_scan_hint_key, optimizer_tables,
    orphan_optimizer_ledger_ids, plan_optimizer_observation_retention,
    relay_read_observation_from_sqlite_row, relay_read_score_from_sqlite_row, relay_read_score_key,
    route_evidence_score_from_sqlite_row, route_evidence_score_key,
    scan_decision_trace_from_sqlite_row, scan_density_model_from_sqlite_row,
    scan_density_model_storage_key, scan_model_key_for_scope, scan_model_keys_for_context,
    scan_model_scope_order, scan_model_scope_rank, scan_model_storage_key,
    scan_observation_from_sqlite_row, select_scan_models_for_context,
    sqlite_optimizer_scan_hint_row, sqlite_relay_read_observation_row, sqlite_relay_read_score_row,
    sqlite_route_evidence_score_row, sqlite_scan_decision_trace_row, sqlite_scan_density_model_row,
    sqlite_scan_observation_row,
};
pub use outcome::{StorageOperation, StorageOutcome, StorageProblem, StorageProblemKind};
pub use pressure::{
    PRESSURE_STOP_REASONS, STORAGE_PRESSURE_META_KEY, SqliteStoragePressureSnapshotRow,
    StoragePressureSnapshotRecord, pressure_problem_kind, pressure_stop_reason_is_known,
    sqlite_storage_pressure_snapshot_row, storage_pressure_from_sqlite_row,
    storage_pressure_json_bytes, storage_pressure_meta_key,
};
pub use relay_sets::{
    RelaySetRecord, SqliteRelaySetRow, relay_set_from_sqlite_row, relay_set_record_id,
    relay_set_record_json_bytes, sqlite_relay_set_row,
};
pub use resource::{CacheOwnerKind, CacheResourceKind};
pub use route_blocks::{RelayRouteBlockRecord, SqliteRelayRouteBlockRow};
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
    diagnostic_sqlite_statements, optimizer_sqlite_statements, protected_sqlite_statements,
    sqlite_repository_statements, sqlite_schema_hash, sqlite_schema_index_names,
    sqlite_schema_indexes, sqlite_schema_statements, sqlite_schema_table,
    sqlite_schema_table_names, sqlite_schema_tables, sqlite_statement, sqlite_table_count_sql,
};
pub use stats::{
    SqliteRowCount, SqliteStorageHealth, StorageInventoryRow, StorageStatsSnapshot,
    StorageTableCount,
};
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
