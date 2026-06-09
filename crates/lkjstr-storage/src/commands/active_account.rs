#![doc = "Active-account selector storage commands."]

use crate::{
    ActiveAccountSelectorRecord, StorageDataClass, StorageOperation, StorageProblemKind,
    commands::spec::{
        StorageCommandFamily, StorageLedgerPolicy, StorageProtectionPolicy,
        StorageRepositoryCommandSpec, StorageStatsProjection,
    },
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorGetInput;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorPutInput {
    pub record: ActiveAccountSelectorRecord,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorDeleteInput;

pub type ActiveAccountSelectorGetOutput = Option<ActiveAccountSelectorRecord>;
pub type ActiveAccountSelectorPutOutput = ();
pub type ActiveAccountSelectorDeleteOutput = ();

pub const ACTIVE_ACCOUNT_SELECTOR_GET_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "active-account-selector.get",
        family: StorageCommandFamily::ActiveSelector,
        operation: StorageOperation::Read,
        input_type: "ActiveAccountSelectorGetInput",
        output_type: "ActiveAccountSelectorGetOutput",
        statements: &["settings.select"],
        tables: &["settings"],
        row_codecs: &["active_account_selector_from_sqlite_row"],
        problem_kinds: &[StorageProblemKind::ActiveAccountSelectorDecodeFailed],
        data_classes: &[StorageDataClass::ProtectedUserData],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::Protected,
        stats_projection: StorageStatsProjection::None,
    };

pub const ACTIVE_ACCOUNT_SELECTOR_PUT_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "active-account-selector.put",
        family: StorageCommandFamily::ActiveSelector,
        operation: StorageOperation::Write,
        input_type: "ActiveAccountSelectorPutInput",
        output_type: "ActiveAccountSelectorPutOutput",
        statements: &["settings.upsert"],
        tables: &["settings"],
        row_codecs: &["sqlite_active_account_selector_row"],
        problem_kinds: &[
            StorageProblemKind::ActiveAccountSelectorDecodeFailed,
            StorageProblemKind::QuotaOrWriteFailed,
        ],
        data_classes: &[StorageDataClass::ProtectedUserData],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::Protected,
        stats_projection: StorageStatsProjection::None,
    };

pub const ACTIVE_ACCOUNT_SELECTOR_DELETE_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "active-account-selector.delete",
        family: StorageCommandFamily::ActiveSelector,
        operation: StorageOperation::Write,
        input_type: "ActiveAccountSelectorDeleteInput",
        output_type: "ActiveAccountSelectorDeleteOutput",
        statements: &["settings.delete"],
        tables: &["settings"],
        row_codecs: &[],
        problem_kinds: &[StorageProblemKind::QuotaOrWriteFailed],
        data_classes: &[StorageDataClass::ProtectedUserData],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::Protected,
        stats_projection: StorageStatsProjection::None,
    };

pub const ACTIVE_ACCOUNT_SELECTOR_COMMANDS: &[StorageRepositoryCommandSpec] = &[
    ACTIVE_ACCOUNT_SELECTOR_GET_COMMAND,
    ACTIVE_ACCOUNT_SELECTOR_PUT_COMMAND,
    ACTIVE_ACCOUNT_SELECTOR_DELETE_COMMAND,
];
