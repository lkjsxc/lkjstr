use serde::{Deserialize, Serialize};

use crate::{CacheResourceKind, StorageProblemKind};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionByteTarget {
    pub target_bytes: u64,
    pub usage_bytes: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionPlanInput {
    pub byte_target: RetentionByteTarget,
    pub candidates: Vec<RetentionCandidate>,
    pub dynamic_protections: Vec<RetentionDynamicProtection>,
    pub inventory_complete: bool,
    pub storage_api_available: bool,
    pub quota_pressure: bool,
    pub compaction_error: bool,
    pub unknown_unowned_usage_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionCandidate {
    pub resource_id: String,
    pub resource_kind: CacheResourceKind,
    pub table_name: String,
    pub byte_count: u64,
    pub score: i64,
    pub updated_at_ms: u64,
    pub protected: bool,
    pub ledger_backed: bool,
    pub recoverable: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionDynamicProtection {
    pub resource_kind: CacheResourceKind,
    pub resource_id: String,
    pub reason: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum RetentionStopReason {
    NoPrunableCandidates,
    ProtectedOnly,
    UnknownUnownedUsage,
    InventoryIncomplete,
    QuotaPressure,
    StorageApiUnavailable,
    CompactionError,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionDeleteIntent {
    pub resource_id: String,
    pub resource_kind: CacheResourceKind,
    pub table_name: String,
    pub estimated_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionPlanSummary {
    pub target_bytes: u64,
    pub usage_bytes: Option<u64>,
    pub bytes_to_free: u64,
    pub candidate_count: usize,
    pub prunable_candidate_count: usize,
    pub selected_count: usize,
    pub selected_bytes: u64,
    pub skipped_protected_count: usize,
    pub skipped_dynamic_protected_count: usize,
    pub skipped_unowned_count: usize,
    pub target_met: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetentionPlan {
    pub intents: Vec<RetentionDeleteIntent>,
    pub summary: RetentionPlanSummary,
    pub stop_reason: Option<RetentionStopReason>,
}

impl RetentionByteTarget {
    #[must_use]
    pub fn bytes_to_free(&self) -> Option<u64> {
        self.usage_bytes
            .map(|usage| usage.saturating_sub(self.target_bytes))
    }
}

impl RetentionStopReason {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NoPrunableCandidates => "no-prunable-candidates",
            Self::ProtectedOnly => "protected-only",
            Self::UnknownUnownedUsage => "unknown-unowned-usage",
            Self::InventoryIncomplete => "inventory-incomplete",
            Self::QuotaPressure => "quota-pressure",
            Self::StorageApiUnavailable => "storage-api-unavailable",
            Self::CompactionError => "compaction-error",
        }
    }

    #[must_use]
    pub const fn problem_kind(self) -> StorageProblemKind {
        match self {
            Self::NoPrunableCandidates => StorageProblemKind::PressureNoPrunableCandidates,
            Self::ProtectedOnly => StorageProblemKind::PressureProtectedOnly,
            Self::UnknownUnownedUsage => StorageProblemKind::PressureUnknownUsage,
            Self::InventoryIncomplete => StorageProblemKind::PressureInventoryIncomplete,
            Self::QuotaPressure => StorageProblemKind::PressureQuota,
            Self::StorageApiUnavailable => StorageProblemKind::PressureStorageApiUnavailable,
            Self::CompactionError => StorageProblemKind::PressureCompactionError,
        }
    }
}

impl RetentionPlanSummary {
    pub(super) fn new(input: &RetentionPlanInput, bytes_to_free: u64) -> Self {
        Self {
            target_bytes: input.byte_target.target_bytes,
            usage_bytes: input.byte_target.usage_bytes,
            bytes_to_free,
            candidate_count: input.candidates.len(),
            prunable_candidate_count: 0,
            selected_count: 0,
            selected_bytes: 0,
            skipped_protected_count: 0,
            skipped_dynamic_protected_count: 0,
            skipped_unowned_count: 0,
            target_met: bytes_to_free == 0,
        }
    }
}
