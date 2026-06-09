#![doc = "Storage inventory command metadata."]

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

pub const STORAGE_INVENTORY_SNAPSHOT_COMMAND: Spec = Spec {
    id: "storage-inventory.snapshot",
    family: Family::Inventory,
    operation: Op::Inventory,
    input_type: "StorageInventorySnapshotInput",
    output_type: "StorageInventorySnapshotOutput",
    statements: &[],
    tables: &[],
    row_codecs: &["storage_stats_snapshot_from_sqlite_counts"],
    problem_kinds: &[
        Problem::UnavailableBrowserCapability,
        Problem::Timeout,
        Problem::Blocked,
    ],
    data_classes: &[Class::Metadata],
    ledger_policy: Ledger::None,
    protection_policy: Protection::InventoryOnly,
    stats_projection: Stats::Inventory,
};

pub const INVENTORY_COMMANDS: &[Spec] = &[STORAGE_INVENTORY_SNAPSHOT_COMMAND];
