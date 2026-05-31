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
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageOutcome<T> {
    Ok(T),
    Unavailable(StorageProblem),
    Timeout(StorageProblem),
    Blocked(StorageProblem),
    Quota(StorageProblem),
    Corrupt(StorageProblem),
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
            | Self::Blocked(problem)
            | Self::Quota(problem)
            | Self::Corrupt(problem)
            | Self::LateSettled(problem)
            | Self::LateRejected(problem) => Some(problem),
        }
    }
}
