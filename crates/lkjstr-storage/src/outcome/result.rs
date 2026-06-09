use super::StorageProblem;

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
