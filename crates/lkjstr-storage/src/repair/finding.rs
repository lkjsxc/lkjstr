use serde::{Deserialize, Serialize};

use crate::StorageProblemKind;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RepairFindingKind {
    SchemaMismatch,
    CorruptRow,
    DecodeFailure,
    OrphanLedgerRow,
    OrphanResourceRow,
    IncompleteInventory,
    TemporaryMemoryMode,
    UnknownUnownedRow,
    SkippedUnknownRow,
    BackfillPlanned,
    BackfillApplied,
    ChunkContinuation,
}

impl RepairFindingKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::SchemaMismatch => "schema-mismatch",
            Self::CorruptRow => "corrupt-row",
            Self::DecodeFailure => "decode-failure",
            Self::OrphanLedgerRow => "orphan-ledger-row",
            Self::OrphanResourceRow => "orphan-resource-row",
            Self::IncompleteInventory => "incomplete-inventory",
            Self::TemporaryMemoryMode => "temporary-memory-mode",
            Self::UnknownUnownedRow => "unknown-unowned-row",
            Self::SkippedUnknownRow => "skipped-unknown-row",
            Self::BackfillPlanned => "backfill-planned",
            Self::BackfillApplied => "backfill-applied",
            Self::ChunkContinuation => "chunk-continuation",
        }
    }

    #[must_use]
    pub const fn problem_kind(self) -> StorageProblemKind {
        match self {
            Self::SchemaMismatch => StorageProblemKind::RepairSchemaMismatch,
            Self::CorruptRow => StorageProblemKind::RepairCorruptRow,
            Self::DecodeFailure => StorageProblemKind::RepairDecodeFailure,
            Self::OrphanLedgerRow => StorageProblemKind::RepairOrphanLedgerRow,
            Self::OrphanResourceRow => StorageProblemKind::RepairOrphanResourceRow,
            Self::IncompleteInventory => StorageProblemKind::RepairIncompleteInventory,
            Self::TemporaryMemoryMode => StorageProblemKind::RepairTemporaryMemoryMode,
            Self::UnknownUnownedRow => StorageProblemKind::RepairUnknownUnownedRow,
            Self::SkippedUnknownRow => StorageProblemKind::RepairSkippedUnknownRow,
            Self::BackfillPlanned => StorageProblemKind::RepairBackfillPlanned,
            Self::BackfillApplied => StorageProblemKind::RepairBackfillApplied,
            Self::ChunkContinuation => StorageProblemKind::RepairChunkContinuation,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairFinding {
    pub kind: RepairFindingKind,
    pub table_name: String,
    pub resource_id: String,
}

impl RepairFinding {
    #[must_use]
    pub fn new(
        kind: RepairFindingKind,
        table_name: impl Into<String>,
        resource_id: impl Into<String>,
    ) -> Self {
        Self {
            kind,
            table_name: table_name.into(),
            resource_id: resource_id.into(),
        }
    }
}
