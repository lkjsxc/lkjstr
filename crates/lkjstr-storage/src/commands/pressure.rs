#![doc = "Storage pressure command metadata."]

use crate::{
    StorageDataClass, StorageOperation, StoragePressureSnapshotRecord, StorageProblemKind,
    commands::spec::{
        StorageCommandFamily, StorageLedgerPolicy, StorageProtectionPolicy,
        StorageRepositoryCommandSpec, StorageStatsProjection,
    },
};

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

pub type StoragePressureGetOutput = Option<StoragePressureSnapshotRecord>;
pub type StoragePressurePutOutput = ();
pub type StoragePressureProjectOutput = Option<StoragePressureSnapshotRecord>;

pub const STORAGE_PRESSURE_GET_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "storage-pressure.get",
        family: StorageCommandFamily::Pressure,
        operation: StorageOperation::Read,
        input_type: "StoragePressureGetInput",
        output_type: "StoragePressureGetOutput",
        statements: &["cache_meta.select"],
        tables: &["cache_meta"],
        row_codecs: &["storage_pressure_from_sqlite_row"],
        problem_kinds: &[StorageProblemKind::PressureSnapshotDecodeFailed],
        data_classes: &[StorageDataClass::Metadata],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::RecoverableDiagnostics,
        stats_projection: StorageStatsProjection::Pressure,
    };

pub const STORAGE_PRESSURE_PUT_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "storage-pressure.put",
        family: StorageCommandFamily::Pressure,
        operation: StorageOperation::Write,
        input_type: "StoragePressurePutInput",
        output_type: "StoragePressurePutOutput",
        statements: &["cache_meta.upsert"],
        tables: &["cache_meta"],
        row_codecs: &["sqlite_storage_pressure_snapshot_row"],
        problem_kinds: &[
            StorageProblemKind::PressureSnapshotDecodeFailed,
            StorageProblemKind::QuotaOrWriteFailed,
        ],
        data_classes: &[StorageDataClass::Metadata],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::RecoverableDiagnostics,
        stats_projection: StorageStatsProjection::Pressure,
    };

pub const STORAGE_PRESSURE_PROJECT_COMMAND: StorageRepositoryCommandSpec =
    StorageRepositoryCommandSpec {
        id: "storage-pressure.project-stats",
        family: StorageCommandFamily::Pressure,
        operation: StorageOperation::Inventory,
        input_type: "StoragePressureProjectInput",
        output_type: "StoragePressureProjectOutput",
        statements: &["cache_meta.select"],
        tables: &["cache_meta"],
        row_codecs: &["storage_pressure_from_sqlite_row"],
        problem_kinds: &[StorageProblemKind::PressureSnapshotDecodeFailed],
        data_classes: &[StorageDataClass::Metadata],
        ledger_policy: StorageLedgerPolicy::None,
        protection_policy: StorageProtectionPolicy::RecoverableDiagnostics,
        stats_projection: StorageStatsProjection::Pressure,
    };

pub const STORAGE_PRESSURE_COMMANDS: &[StorageRepositoryCommandSpec] = &[
    STORAGE_PRESSURE_GET_COMMAND,
    STORAGE_PRESSURE_PUT_COMMAND,
    STORAGE_PRESSURE_PROJECT_COMMAND,
];
