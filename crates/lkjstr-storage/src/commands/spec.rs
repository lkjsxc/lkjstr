#![doc = "Shared storage command metadata shape."]

use crate::{StorageDataClass, StorageOperation, StorageProblemKind};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageRepositoryCommandSpec {
    pub id: &'static str,
    pub family: StorageCommandFamily,
    pub operation: StorageOperation,
    pub input_type: &'static str,
    pub output_type: &'static str,
    pub statements: &'static [&'static str],
    pub tables: &'static [&'static str],
    pub row_codecs: &'static [&'static str],
    pub problem_kinds: &'static [StorageProblemKind],
    pub data_classes: &'static [StorageDataClass],
    pub ledger_policy: StorageLedgerPolicy,
    pub protection_policy: StorageProtectionPolicy,
    pub stats_projection: StorageStatsProjection,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageCommandFamily {
    Protected,
    ActiveSelector,
    EventCache,
    FeedEvidence,
    SearchIndex,
    RelayDiagnostics,
    Jobs,
    AppLog,
    Optimizer,
    Retention,
    Repair,
    Inventory,
    Pressure,
}

impl StorageCommandFamily {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Protected => "protected",
            Self::ActiveSelector => "active-selector",
            Self::EventCache => "event-cache",
            Self::FeedEvidence => "feed-evidence",
            Self::SearchIndex => "search-index",
            Self::RelayDiagnostics => "relay-diagnostics",
            Self::Jobs => "jobs",
            Self::AppLog => "app-log",
            Self::Optimizer => "optimizer",
            Self::Retention => "retention",
            Self::Repair => "repair",
            Self::Inventory => "inventory",
            Self::Pressure => "pressure",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageLedgerPolicy {
    None,
    ResourceAndLedgerSameBatch,
    ReadsLedger,
    DeletesLedgerBackedRows,
    RepairsLedger,
}

impl StorageLedgerPolicy {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::ResourceAndLedgerSameBatch => "resource-and-ledger-same-batch",
            Self::ReadsLedger => "reads-ledger",
            Self::DeletesLedgerBackedRows => "deletes-ledger-backed-rows",
            Self::RepairsLedger => "repairs-ledger",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageProtectionPolicy {
    Protected,
    RecoverableCache,
    RecoverableDiagnostics,
    Mixed,
    InventoryOnly,
}

impl StorageProtectionPolicy {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Protected => "protected",
            Self::RecoverableCache => "recoverable-cache",
            Self::RecoverableDiagnostics => "recoverable-diagnostics",
            Self::Mixed => "mixed",
            Self::InventoryOnly => "inventory-only",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageStatsProjection {
    None,
    StorageHealth,
    Inventory,
    Pressure,
    CacheSummary,
    RelayDiagnostics,
    Optimizer,
    Jobs,
    AppLog,
}

impl StorageStatsProjection {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::StorageHealth => "storage-health",
            Self::Inventory => "inventory",
            Self::Pressure => "pressure",
            Self::CacheSummary => "cache-summary",
            Self::RelayDiagnostics => "relay-diagnostics",
            Self::Optimizer => "optimizer",
            Self::Jobs => "jobs",
            Self::AppLog => "app-log",
        }
    }
}
