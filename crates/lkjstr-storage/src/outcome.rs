#![doc = "Typed storage operation outcomes."]

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageOutcome<T> {
    Ok(T),
    Unavailable(StorageProblem),
    Timeout(StorageProblem),
    Busy(StorageProblem),
    Blocked(StorageProblem),
    Quota(StorageProblem),
    Corrupt(StorageProblem),
    Canceled(StorageProblem),
    LateSettled(StorageProblem),
    LateRejected(StorageProblem),
}

impl<T> StorageOutcome<T> {
    #[must_use]
    pub const fn is_ok(&self) -> bool {
        matches!(self, Self::Ok(_))
    }

    #[must_use]
    pub const fn problem(&self) -> Option<&StorageProblem> {
        match self {
            Self::Ok(_) => None,
            Self::Unavailable(problem)
            | Self::Timeout(problem)
            | Self::Busy(problem)
            | Self::Blocked(problem)
            | Self::Quota(problem)
            | Self::Corrupt(problem)
            | Self::Canceled(problem)
            | Self::LateSettled(problem)
            | Self::LateRejected(problem) => Some(problem),
        }
    }

    pub fn map<U>(self, value: impl FnOnce(T) -> U) -> StorageOutcome<U> {
        match self {
            Self::Ok(inner) => StorageOutcome::Ok(value(inner)),
            Self::Unavailable(problem) => StorageOutcome::Unavailable(problem),
            Self::Timeout(problem) => StorageOutcome::Timeout(problem),
            Self::Busy(problem) => StorageOutcome::Busy(problem),
            Self::Blocked(problem) => StorageOutcome::Blocked(problem),
            Self::Quota(problem) => StorageOutcome::Quota(problem),
            Self::Corrupt(problem) => StorageOutcome::Corrupt(problem),
            Self::Canceled(problem) => StorageOutcome::Canceled(problem),
            Self::LateSettled(problem) => StorageOutcome::LateSettled(problem),
            Self::LateRejected(problem) => StorageOutcome::LateRejected(problem),
        }
    }
}
