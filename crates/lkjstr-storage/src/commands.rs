#![doc = "Typed storage repository command contracts."]

use crate::{
    ActiveAccountSelectorRecord, StorageDataClass, StorageOperation, StoragePressureSnapshotRecord,
    StorageProblemKind,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageRepositoryCommandSpec {
    pub name: &'static str,
    pub table: &'static str,
    pub input_type: &'static str,
    pub output_type: &'static str,
    pub operation: StorageOperation,
    pub problem_kind: StorageProblemKind,
    pub row_codec: &'static str,
    pub data_class: StorageDataClass,
    pub protected: bool,
    pub prunable: bool,
    pub stats_projection: &'static str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorGetInput;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorPutInput {
    pub record: ActiveAccountSelectorRecord,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActiveAccountSelectorDeleteInput;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StoragePressureGetInput;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoragePressurePutInput {
    pub snapshot: StoragePressureSnapshotRecord,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoragePressureProjectInput {
    pub snapshot: Option<StoragePressureSnapshotRecord>,
}

pub type ActiveAccountSelectorGetOutput = Option<ActiveAccountSelectorRecord>;
pub type ActiveAccountSelectorPutOutput = ();
pub type ActiveAccountSelectorDeleteOutput = ();
pub type StoragePressureGetOutput = Option<StoragePressureSnapshotRecord>;
pub type StoragePressurePutOutput = ();
pub type StoragePressureProjectOutput = Option<StoragePressureSnapshotRecord>;

macro_rules! command {
    ($name:literal, $table:literal, $input:literal, $output:literal, $operation:ident, $problem:ident, $codec:literal, $class:ident, $protected:literal, $prunable:literal, $stats:literal) => {
        StorageRepositoryCommandSpec {
            name: $name,
            table: $table,
            input_type: $input,
            output_type: $output,
            operation: StorageOperation::$operation,
            problem_kind: StorageProblemKind::$problem,
            row_codec: $codec,
            data_class: StorageDataClass::$class,
            protected: $protected,
            prunable: $prunable,
            stats_projection: $stats,
        }
    };
}

pub const STORAGE_REPOSITORY_COMMANDS: &[StorageRepositoryCommandSpec] = &[
    command!(
        "active-account-selector.get",
        "settings",
        "ActiveAccountSelectorGetInput",
        "ActiveAccountSelectorGetOutput",
        Read,
        ActiveAccountSelectorDecodeFailed,
        "active_account_selector_from_sqlite_row",
        ProtectedUserData,
        true,
        false,
        "active-account-state"
    ),
    command!(
        "active-account-selector.put",
        "settings",
        "ActiveAccountSelectorPutInput",
        "ActiveAccountSelectorPutOutput",
        Write,
        QuotaOrWriteFailed,
        "sqlite_active_account_selector_row",
        ProtectedUserData,
        true,
        false,
        "active-account-state"
    ),
    command!(
        "active-account-selector.delete",
        "settings",
        "ActiveAccountSelectorDeleteInput",
        "ActiveAccountSelectorDeleteOutput",
        Write,
        QuotaOrWriteFailed,
        "settings.delete",
        ProtectedUserData,
        true,
        false,
        "active-account-state"
    ),
    command!(
        "storage-pressure.get",
        "cacheMeta",
        "StoragePressureGetInput",
        "StoragePressureGetOutput",
        Read,
        PressureSnapshotDecodeFailed,
        "storage_pressure_from_sqlite_row",
        Metadata,
        false,
        false,
        "pressure-health"
    ),
    command!(
        "storage-pressure.put",
        "cacheMeta",
        "StoragePressurePutInput",
        "StoragePressurePutOutput",
        Write,
        QuotaOrWriteFailed,
        "sqlite_storage_pressure_snapshot_row",
        Metadata,
        false,
        false,
        "pressure-health"
    ),
    command!(
        "storage-pressure.project-stats",
        "cacheMeta",
        "StoragePressureProjectInput",
        "StoragePressureProjectOutput",
        Inventory,
        PressureSnapshotDecodeFailed,
        "storage_pressure_from_sqlite_row",
        Metadata,
        false,
        false,
        "pressure-health"
    ),
];

#[must_use]
pub const fn storage_repository_commands() -> &'static [StorageRepositoryCommandSpec] {
    STORAGE_REPOSITORY_COMMANDS
}
