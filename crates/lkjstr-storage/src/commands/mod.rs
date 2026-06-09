#![doc = "Typed storage repository command contracts."]

pub mod active_account;
pub mod app_log;
pub mod diagnostics;
pub mod events;
pub mod feed_cache;
pub mod inventory;
pub mod jobs;
pub mod optimizer;
pub mod pressure;
pub mod protected;
pub mod repair;
pub mod retention;
pub mod search;
pub mod spec;

pub use active_account::{
    ActiveAccountSelectorDeleteInput, ActiveAccountSelectorDeleteOutput,
    ActiveAccountSelectorGetInput, ActiveAccountSelectorGetOutput, ActiveAccountSelectorPutInput,
    ActiveAccountSelectorPutOutput,
};
pub use pressure::{
    StoragePressureGetInput, StoragePressureGetOutput, StoragePressureProjectInput,
    StoragePressureProjectOutput, StoragePressurePutInput, StoragePressurePutOutput,
};
pub use repair::{
    RepairBackfillInput, RepairBackfillOutput, RepairInventoryReportInput,
    RepairInventoryReportOutput, RepairScanInput, RepairScanOutput,
};
pub use retention::{
    RetentionDeleteDispatchInput, RetentionDeleteDispatchOutput, RetentionPlanOutput,
};
pub use search::{
    SearchLocalQueryInput, SearchLocalQueryOutput, SearchUpdateEventIndexInput,
    SearchUpdateEventIndexOutput, TagLookupByValueInput, TagLookupByValueOutput,
};
pub use spec::{
    StorageCommandFamily, StorageLedgerPolicy, StorageProtectionPolicy,
    StorageRepositoryCommandSpec, StorageStatsProjection,
};

pub const STORAGE_REPOSITORY_COMMANDS: &[StorageRepositoryCommandSpec] = &[
    active_account::ACTIVE_ACCOUNT_SELECTOR_GET_COMMAND,
    active_account::ACTIVE_ACCOUNT_SELECTOR_PUT_COMMAND,
    active_account::ACTIVE_ACCOUNT_SELECTOR_DELETE_COMMAND,
    pressure::STORAGE_PRESSURE_GET_COMMAND,
    pressure::STORAGE_PRESSURE_PUT_COMMAND,
    pressure::STORAGE_PRESSURE_PROJECT_COMMAND,
    protected::SETTINGS_PUT_COMMAND,
    protected::SETTINGS_DELETE_COMMAND,
    protected::SETTINGS_GET_COMMAND,
    protected::SETTINGS_ALL_COMMAND,
    protected::SETTINGS_REPLACE_ALL_COMMAND,
    protected::WORKSPACE_PUT_COMMAND,
    protected::WORKSPACE_GET_COMMAND,
    protected::TAB_STATE_PUT_COMMAND,
    protected::TAB_STATE_DELETE_COMMAND,
    protected::TAB_STATE_GET_COMMAND,
    protected::TAB_STATES_FOR_WORKSPACE_COMMAND,
    protected::TAB_STATE_LEDGER_GET_COMMAND,
    protected::ACCOUNT_PUT_COMMAND,
    protected::ACCOUNT_LOCAL_PUT_COMMAND,
    protected::ACCOUNT_DELETE_COMMAND,
    protected::ACCOUNT_GET_COMMAND,
    protected::ACCOUNTS_ALL_COMMAND,
    protected::LOCAL_SECRET_PUT_COMMAND,
    protected::LOCAL_SECRET_GET_COMMAND,
    protected::LOCAL_SECRET_DELETE_COMMAND,
    protected::RELAY_SET_PUT_COMMAND,
    protected::RELAY_SET_GET_COMMAND,
    protected::RELAY_SETS_ALL_COMMAND,
    protected::RELAY_SETS_PUT_ALL_COMMAND,
    protected::TWEET_DRAFT_PUT_COMMAND,
    protected::TWEET_DRAFT_DELETE_COMMAND,
    protected::TWEET_DRAFT_GET_COMMAND,
    events::EVENT_PUT_COMMAND,
    events::EVENT_GET_COMMAND,
    events::EVENT_RELAYS_COMMAND,
    events::EVENTS_BY_TAG_VALUE_COMMAND,
    events::EVENTS_BY_KIND_COMMAND,
    events::EVENTS_BY_AUTHOR_KIND_COMMAND,
    feed_cache::FEED_CURSOR_PUT_COMMAND,
    feed_cache::FEED_CURSOR_GET_COMMAND,
    feed_cache::FEED_COVERAGE_PUT_COMMAND,
    feed_cache::FEED_COVERAGE_FOR_FEED_COMMAND,
    feed_cache::FEED_SCAN_HINT_PUT_COMMAND,
    feed_cache::FEED_SCAN_HINTS_FOR_FEED_COMMAND,
    diagnostics::RELAY_INFORMATION_PUT_COMMAND,
    diagnostics::RELAY_INFORMATION_GET_COMMAND,
    diagnostics::RELAY_INFORMATION_RECENT_COMMAND,
    diagnostics::RELAY_SUMMARY_PUT_COMMAND,
    diagnostics::RELAY_SUMMARY_GET_COMMAND,
    diagnostics::RELAY_SUMMARIES_RECENT_COMMAND,
    diagnostics::RELAY_SUGGESTIONS_PUT_COMMAND,
    diagnostics::RELAY_SUGGESTIONS_FOR_PUBKEY_COMMAND,
    diagnostics::AUTHOR_ROUTES_PUT_COMMAND,
    diagnostics::AUTHOR_ROUTES_FOR_PUBKEY_COMMAND,
    diagnostics::ROUTE_BLOCK_PUT_COMMAND,
    diagnostics::ROUTE_BLOCK_DELETE_COMMAND,
    diagnostics::ROUTE_BLOCKS_RECENT_COMMAND,
    diagnostics::NOTIFICATIONS_PUT_COMMAND,
    diagnostics::NOTIFICATIONS_FOR_OWNER_COMMAND,
    jobs::JOB_PUT_COMMAND,
    jobs::JOB_GET_COMMAND,
    jobs::JOBS_RECENT_COMMAND,
    optimizer::FEED_SCAN_OBSERVATION_INSERT_COMMAND,
    optimizer::FEED_SCAN_DENSITY_MODEL_SELECT_CONTEXT_COMMAND,
    optimizer::FEED_SCAN_DENSITY_MODEL_UPSERT_COMMAND,
    optimizer::FEED_SCAN_DECISION_TRACE_INSERT_COMMAND,
    retention::RETENTION_PLAN_COMMAND,
    retention::RETENTION_DELETE_DISPATCH_COMMAND,
    repair::REPAIR_SCAN_LEDGER_COMMAND,
    repair::REPAIR_BACKFILL_LEDGER_COMMAND,
    repair::REPAIR_REPORT_INVENTORY_COMMAND,
    search::TAG_LOOKUP_BY_VALUE_COMMAND,
    search::SEARCH_UPDATE_EVENT_INDEX_COMMAND,
    search::SEARCH_LOCAL_QUERY_COMMAND,
    app_log::APP_LOG_INSERT_COMMAND,
    app_log::APP_LOG_RECENT_COMMAND,
    app_log::APP_LOG_CLEAR_BEFORE_COMMAND,
    inventory::STORAGE_INVENTORY_SNAPSHOT_COMMAND,
];

#[must_use]
pub const fn storage_repository_commands() -> &'static [StorageRepositoryCommandSpec] {
    STORAGE_REPOSITORY_COMMANDS
}
