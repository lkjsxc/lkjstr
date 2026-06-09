#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageOperation {
    Read,
    Write,
    Transaction,
    Inventory,
    Repair,
    Compaction,
}

impl StorageOperation {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
            Self::Transaction => "transaction",
            Self::Inventory => "inventory",
            Self::Repair => "repair",
            Self::Compaction => "compaction",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageProblemKind {
    UnavailableBrowserCapability,
    OpfsOpenFailed,
    SqliteWorkerInitFailed,
    TemporaryMemoryFallbackActive,
    SchemaRepairPerformed,
    SchemaRepairFailed,
    ProtectedRecordDecodeFailed,
    CacheRecordDecodeFailed,
    QuotaOrWriteFailed,
    Busy,
    Blocked,
    Timeout,
    Corrupt,
    Canceled,
    LateSettled,
    LateRejected,
    ActiveAccountSelectorDecodeFailed,
    PressureSnapshotDecodeFailed,
    OptimizerRecordDecodeFailed,
    PressureNoPrunableCandidates,
    PressureProtectedOnly,
    PressureUnknownUsage,
    PressureInventoryIncomplete,
    PressureQuota,
    PressureStorageApiUnavailable,
    PressureCompactionError,
    PressureDeadline,
    RepairSchemaMismatch,
    RepairCorruptRow,
    RepairDecodeFailure,
    RepairOrphanLedgerRow,
    RepairOrphanResourceRow,
    RepairIncompleteInventory,
    RepairTemporaryMemoryMode,
    RepairUnknownUnownedRow,
    RepairSkippedUnknownRow,
    RepairBackfillPlanned,
    RepairBackfillApplied,
    RepairChunkContinuation,
}

impl StorageProblemKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::UnavailableBrowserCapability => "unavailable-browser-capability",
            Self::OpfsOpenFailed => "opfs-open-failed",
            Self::SqliteWorkerInitFailed => "sqlite-worker-init-failed",
            Self::TemporaryMemoryFallbackActive => "temporary-memory-fallback-active",
            Self::SchemaRepairPerformed => "schema-repair-performed",
            Self::SchemaRepairFailed => "schema-repair-failed",
            Self::ProtectedRecordDecodeFailed => "protected-record-decode-failed",
            Self::CacheRecordDecodeFailed => "cache-record-decode-failed",
            Self::QuotaOrWriteFailed => "quota-or-write-failed",
            Self::Busy => "busy",
            Self::Blocked => "blocked",
            Self::Timeout => "timeout",
            Self::Corrupt => "corrupt",
            Self::Canceled => "canceled",
            Self::LateSettled => "late-settled",
            Self::LateRejected => "late-rejected",
            Self::ActiveAccountSelectorDecodeFailed => "active-account-selector-decode-failed",
            Self::PressureSnapshotDecodeFailed => "pressure-snapshot-decode-failed",
            Self::OptimizerRecordDecodeFailed => "optimizer-record-decode-failed",
            Self::PressureNoPrunableCandidates => "pressure-no-prunable-candidates",
            Self::PressureProtectedOnly => "pressure-protected-only",
            Self::PressureUnknownUsage => "pressure-unknown-usage",
            Self::PressureInventoryIncomplete => "pressure-inventory-incomplete",
            Self::PressureQuota => "pressure-quota",
            Self::PressureStorageApiUnavailable => "pressure-storage-api-unavailable",
            Self::PressureCompactionError => "pressure-compaction-error",
            Self::PressureDeadline => "pressure-deadline",
            Self::RepairSchemaMismatch => "repair-schema-mismatch",
            Self::RepairCorruptRow => "repair-corrupt-row",
            Self::RepairDecodeFailure => "repair-decode-failure",
            Self::RepairOrphanLedgerRow => "repair-orphan-ledger-row",
            Self::RepairOrphanResourceRow => "repair-orphan-resource-row",
            Self::RepairIncompleteInventory => "repair-incomplete-inventory",
            Self::RepairTemporaryMemoryMode => "repair-temporary-memory-mode",
            Self::RepairUnknownUnownedRow => "repair-unknown-unowned-row",
            Self::RepairSkippedUnknownRow => "repair-skipped-unknown-row",
            Self::RepairBackfillPlanned => "repair-backfill-planned",
            Self::RepairBackfillApplied => "repair-backfill-applied",
            Self::RepairChunkContinuation => "repair-chunk-continuation",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StorageProblem {
    pub operation: StorageOperation,
    pub table: &'static str,
    pub reason: &'static str,
    pub operation_id: String,
}

impl StorageProblem {
    #[must_use]
    pub fn new(
        operation: StorageOperation,
        table: &'static str,
        reason: &'static str,
        operation_id: impl Into<String>,
    ) -> Self {
        Self {
            operation,
            table,
            reason,
            operation_id: operation_id.into(),
        }
    }

    #[must_use]
    pub fn with_kind(
        operation: StorageOperation,
        table: &'static str,
        kind: StorageProblemKind,
        operation_id: impl Into<String>,
    ) -> Self {
        Self::new(operation, table, kind.as_str(), operation_id)
    }
}
