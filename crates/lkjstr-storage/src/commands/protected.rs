#![doc = "Protected storage command metadata."]

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

const PROTECTED_READ: &[Problem] = &[Problem::ProtectedRecordDecodeFailed];
const CACHE_READ: &[Problem] = &[Problem::CacheRecordDecodeFailed];
const WRITE: &[Problem] = &[Problem::QuotaOrWriteFailed];
const PROTECTED_WRITE: &[Problem] = &[
    Problem::ProtectedRecordDecodeFailed,
    Problem::QuotaOrWriteFailed,
];
const USER: &[Class] = &[Class::ProtectedUserData];
const USER_AND_LEDGER: &[Class] = &[Class::ProtectedUserData, Class::Ledger];
const LEDGER_CLASS: &[Class] = &[Class::Ledger];

#[allow(clippy::too_many_arguments)]
const fn protected(
    id: &'static str,
    operation: Op,
    input_type: &'static str,
    output_type: &'static str,
    statements: &'static [&'static str],
    tables: &'static [&'static str],
    row_codecs: &'static [&'static str],
    problem_kinds: &'static [Problem],
    data_classes: &'static [Class],
    ledger_policy: Ledger,
    stats_projection: Stats,
) -> Spec {
    Spec {
        id,
        family: Family::Protected,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes,
        ledger_policy,
        protection_policy: Protection::Protected,
        stats_projection,
    }
}

#[rustfmt::skip]
pub const SETTINGS_PUT_COMMAND: Spec = protected("settings.put", Op::Write, "SettingPutInput", "SettingPutOutput", &["settings.upsert"], &["settings"], &["sqlite_setting_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const SETTINGS_DELETE_COMMAND: Spec = protected("settings.delete", Op::Write, "SettingDeleteInput", "SettingDeleteOutput", &["settings.delete"], &["settings"], &[], WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const SETTINGS_GET_COMMAND: Spec = protected("settings.get", Op::Read, "SettingGetInput", "SettingGetOutput", &["settings.select"], &["settings"], &["setting_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const SETTINGS_ALL_COMMAND: Spec = protected("settings.all", Op::Read, "SettingsAllInput", "SettingsAllOutput", &["settings.all"], &["settings"], &["setting_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const SETTINGS_REPLACE_ALL_COMMAND: Spec = protected("settings.replace-all", Op::Transaction, "SettingsReplaceAllInput", "SettingsReplaceAllOutput", &["settings.clear", "settings.upsert"], &["settings"], &["sqlite_setting_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const WORKSPACE_PUT_COMMAND: Spec = protected("workspace.put", Op::Write, "WorkspacePutInput", "WorkspacePutOutput", &["workspaces.upsert"], &["workspaces"], &["sqlite_workspace_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const WORKSPACE_GET_COMMAND: Spec = protected("workspace.get", Op::Read, "WorkspaceGetInput", "WorkspaceGetOutput", &["workspaces.select"], &["workspaces"], &["workspace_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TAB_STATE_PUT_COMMAND: Spec = protected("tab-state.put", Op::Transaction, "TabStatePutInput", "TabStatePutOutput", &["tab_states.upsert", "cache_ledger.upsert"], &["tab_states", "cache_ledger"], &["sqlite_tab_state_row", "sqlite_cache_ledger_row"], PROTECTED_WRITE, USER_AND_LEDGER, Ledger::ResourceAndLedgerSameBatch, Stats::CacheSummary);
#[rustfmt::skip]
pub const TAB_STATE_DELETE_COMMAND: Spec = protected("tab-state.delete", Op::Transaction, "TabStateDeleteInput", "TabStateDeleteOutput", &["tab_states.delete", "cache_ledger.delete"], &["tab_states", "cache_ledger"], &[], PROTECTED_WRITE, USER_AND_LEDGER, Ledger::DeletesLedgerBackedRows, Stats::CacheSummary);
#[rustfmt::skip]
pub const TAB_STATE_GET_COMMAND: Spec = protected("tab-state.get", Op::Read, "TabStateGetInput", "TabStateGetOutput", &["tab_states.select"], &["tab_states"], &["tab_state_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TAB_STATES_FOR_WORKSPACE_COMMAND: Spec = protected("tab-state.for-workspace", Op::Read, "TabStatesForWorkspaceInput", "TabStatesForWorkspaceOutput", &["tab_states.by_workspace"], &["tab_states"], &["tab_state_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TAB_STATE_LEDGER_GET_COMMAND: Spec = protected("tab-state.ledger-get", Op::Read, "TabStateLedgerGetInput", "TabStateLedgerGetOutput", &["cache_ledger.select"], &["cache_ledger"], &["sqlite_cache_ledger_row"], CACHE_READ, LEDGER_CLASS, Ledger::ReadsLedger, Stats::CacheSummary);
#[rustfmt::skip]
pub const ACCOUNT_PUT_COMMAND: Spec = protected("account.put", Op::Write, "AccountPutInput", "AccountPutOutput", &["accounts.upsert"], &["accounts"], &["sqlite_account_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const ACCOUNT_LOCAL_PUT_COMMAND: Spec = protected("account.local-put", Op::Transaction, "LocalAccountPutInput", "LocalAccountPutOutput", &["accounts.upsert", "local_account_secrets.upsert"], &["accounts", "local_account_secrets"], &["sqlite_account_row", "sqlite_local_secret_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const ACCOUNT_DELETE_COMMAND: Spec = protected("account.delete", Op::Write, "AccountDeleteInput", "AccountDeleteOutput", &["accounts.delete"], &["accounts"], &[], WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const ACCOUNT_GET_COMMAND: Spec = protected("account.get", Op::Read, "AccountGetInput", "AccountGetOutput", &["accounts.select"], &["accounts"], &["account_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const ACCOUNTS_ALL_COMMAND: Spec = protected("account.all", Op::Read, "AccountsAllInput", "AccountsAllOutput", &["accounts.all"], &["accounts"], &["account_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const LOCAL_SECRET_PUT_COMMAND: Spec = protected("local-secret.put", Op::Write, "LocalSecretPutInput", "LocalSecretPutOutput", &["local_account_secrets.upsert"], &["local_account_secrets"], &["sqlite_local_secret_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const LOCAL_SECRET_GET_COMMAND: Spec = protected("local-secret.get", Op::Read, "LocalSecretGetInput", "LocalSecretGetOutput", &["local_account_secrets.select"], &["local_account_secrets"], &["local_secret_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const LOCAL_SECRET_DELETE_COMMAND: Spec = protected("local-secret.delete", Op::Write, "LocalSecretDeleteInput", "LocalSecretDeleteOutput", &["local_account_secrets.delete"], &["local_account_secrets"], &[], WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const RELAY_SET_PUT_COMMAND: Spec = protected("relay-set.put", Op::Write, "RelaySetPutInput", "RelaySetPutOutput", &["relay_sets.upsert"], &["relay_sets"], &["sqlite_relay_set_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const RELAY_SET_GET_COMMAND: Spec = protected("relay-set.get", Op::Read, "RelaySetGetInput", "RelaySetGetOutput", &["relay_sets.select"], &["relay_sets"], &["relay_set_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const RELAY_SETS_ALL_COMMAND: Spec = protected("relay-set.all", Op::Read, "RelaySetsAllInput", "RelaySetsAllOutput", &["relay_sets.all"], &["relay_sets"], &["relay_set_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const RELAY_SETS_PUT_ALL_COMMAND: Spec = protected("relay-set.put-all", Op::Transaction, "RelaySetsPutAllInput", "RelaySetsPutAllOutput", &["relay_sets.upsert"], &["relay_sets"], &["sqlite_relay_set_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TWEET_DRAFT_PUT_COMMAND: Spec = protected("tweet-draft.put", Op::Write, "TweetDraftPutInput", "TweetDraftPutOutput", &["tweet_drafts.upsert"], &["tweet_drafts"], &["sqlite_tweet_draft_row"], PROTECTED_WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TWEET_DRAFT_DELETE_COMMAND: Spec = protected("tweet-draft.delete", Op::Write, "TweetDraftDeleteInput", "TweetDraftDeleteOutput", &["tweet_drafts.delete"], &["tweet_drafts"], &[], WRITE, USER, Ledger::None, Stats::None);
#[rustfmt::skip]
pub const TWEET_DRAFT_GET_COMMAND: Spec = protected("tweet-draft.get", Op::Read, "TweetDraftGetInput", "TweetDraftGetOutput", &["tweet_drafts.select"], &["tweet_drafts"], &["tweet_draft_from_sqlite_row"], PROTECTED_READ, USER, Ledger::None, Stats::None);

pub const PROTECTED_COMMANDS: &[Spec] = &[
    SETTINGS_PUT_COMMAND,
    SETTINGS_DELETE_COMMAND,
    SETTINGS_GET_COMMAND,
    SETTINGS_ALL_COMMAND,
    SETTINGS_REPLACE_ALL_COMMAND,
    WORKSPACE_PUT_COMMAND,
    WORKSPACE_GET_COMMAND,
    TAB_STATE_PUT_COMMAND,
    TAB_STATE_DELETE_COMMAND,
    TAB_STATE_GET_COMMAND,
    TAB_STATES_FOR_WORKSPACE_COMMAND,
    TAB_STATE_LEDGER_GET_COMMAND,
    ACCOUNT_PUT_COMMAND,
    ACCOUNT_LOCAL_PUT_COMMAND,
    ACCOUNT_DELETE_COMMAND,
    ACCOUNT_GET_COMMAND,
    ACCOUNTS_ALL_COMMAND,
    LOCAL_SECRET_PUT_COMMAND,
    LOCAL_SECRET_GET_COMMAND,
    LOCAL_SECRET_DELETE_COMMAND,
    RELAY_SET_PUT_COMMAND,
    RELAY_SET_GET_COMMAND,
    RELAY_SETS_ALL_COMMAND,
    RELAY_SETS_PUT_ALL_COMMAND,
    TWEET_DRAFT_PUT_COMMAND,
    TWEET_DRAFT_DELETE_COMMAND,
    TWEET_DRAFT_GET_COMMAND,
];
