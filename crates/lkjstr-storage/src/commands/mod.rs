#![doc = "Typed storage repository command contracts."]

pub mod active_account;
pub mod pressure;
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
];

#[must_use]
pub const fn storage_repository_commands() -> &'static [StorageRepositoryCommandSpec] {
    STORAGE_REPOSITORY_COMMANDS
}
