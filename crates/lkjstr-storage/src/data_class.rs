#![doc = "Storage data class and inventory group strings."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageDataClass {
    ProtectedUserData,
    ProtectedSafetyConfiguration,
    RecoverableCache,
    DerivedFeedCache,
    DiagnosticsCache,
    Ledger,
    Metadata,
}

impl StorageDataClass {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ProtectedUserData => "protected-user-data",
            Self::ProtectedSafetyConfiguration => "protected-safety-configuration",
            Self::RecoverableCache => "recoverable-cache",
            Self::DerivedFeedCache => "derived-feed-cache",
            Self::DiagnosticsCache => "diagnostics-cache",
            Self::Ledger => "ledger",
            Self::Metadata => "metadata",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageInventoryGroup {
    Protected,
    ProtectedSafety,
    PrunableCache,
    DerivedPageCache,
    Diagnostics,
    Ledger,
    Metadata,
}

impl StorageInventoryGroup {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Protected => "protected",
            Self::ProtectedSafety => "protected-safety",
            Self::PrunableCache => "prunable-cache",
            Self::DerivedPageCache => "derived-page-cache",
            Self::Diagnostics => "diagnostics",
            Self::Ledger => "ledger",
            Self::Metadata => "metadata",
        }
    }
}
