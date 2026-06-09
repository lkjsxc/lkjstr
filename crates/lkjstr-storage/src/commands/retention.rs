#![doc = "Retention storage command metadata."]

use crate::{
    RetentionDeleteIntent, RetentionPlan, RetentionPlanInput, RetentionStopReason,
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

pub type RetentionPlanOutput = RetentionPlan;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetentionDeleteDispatchInput {
    pub intents: Vec<RetentionDeleteIntent>,
    pub bytes_targeted: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetentionDeleteDispatchOutput {
    pub attempted_count: usize,
    pub deleted_count: usize,
    pub skipped_protected_count: usize,
    pub skipped_dynamic_protected_count: usize,
    pub bytes_targeted: u64,
    pub bytes_deleted_or_estimated: u64,
    pub stop_reason: Option<RetentionStopReason>,
    pub problems: Vec<Problem>,
}

const RETENTION_PROBLEMS: &[Problem] = &[
    Problem::CacheRecordDecodeFailed,
    Problem::UnavailableBrowserCapability,
    Problem::Timeout,
    Problem::Blocked,
    Problem::QuotaOrWriteFailed,
    Problem::PressureNoPrunableCandidates,
    Problem::PressureProtectedOnly,
    Problem::PressureUnknownUsage,
    Problem::PressureInventoryIncomplete,
    Problem::PressureQuota,
    Problem::PressureStorageApiUnavailable,
    Problem::PressureCompactionError,
];
const RETENTION_CLASSES: &[Class] = &[
    Class::Ledger,
    Class::RecoverableCache,
    Class::DerivedFeedCache,
    Class::DiagnosticsCache,
];
const RETENTION_PLAN_CLASSES: &[Class] = &[
    Class::Ledger,
    Class::RecoverableCache,
    Class::DerivedFeedCache,
    Class::DiagnosticsCache,
    Class::Metadata,
];
const RETENTION_DELETE_STATEMENTS: &[&str] = &[
    "events.delete",
    "event_tags.delete_by_event",
    "event_relays.delete_by_event",
    "notifications.delete",
    "feed_cursors.delete",
    "feed_coverage.delete",
    "feed_scan_hints.delete",
    "relay_diagnostic_summaries.delete",
    "relay_information.delete",
    "relay_read_observations.delete",
    "relay_read_scores.delete",
    "relay_list_suggestions.delete",
    "author_relay_routes.delete",
    "route_evidence_scores.delete",
    "jobs.delete",
    "cache_ledger.delete",
];
const RETENTION_DELETE_TABLES: &[&str] = &[
    "events",
    "event_tags",
    "event_relays",
    "notifications",
    "feed_cursors",
    "feed_coverage",
    "feed_scan_hints",
    "relay_diagnostic_summaries",
    "relay_information",
    "relay_read_observations",
    "relay_read_scores",
    "relay_list_suggestions",
    "author_relay_routes",
    "route_evidence_scores",
    "jobs",
    "cache_ledger",
];

pub const RETENTION_PLAN_COMMAND: Spec = Spec {
    id: "retention.plan",
    family: Family::Retention,
    operation: Op::Compaction,
    input_type: "RetentionPlanInput",
    output_type: "RetentionPlanOutput",
    statements: &["cache_ledger.compaction_candidates"],
    tables: &["cache_ledger"],
    row_codecs: &[
        "sqlite_cache_ledger_row",
        "retention_candidate_from_ledger_row",
    ],
    problem_kinds: RETENTION_PROBLEMS,
    data_classes: RETENTION_PLAN_CLASSES,
    ledger_policy: Ledger::ReadsLedger,
    protection_policy: Protection::Mixed,
    stats_projection: Stats::Pressure,
};

pub const RETENTION_DELETE_DISPATCH_COMMAND: Spec = Spec {
    id: "retention.delete-dispatch",
    family: Family::Retention,
    operation: Op::Compaction,
    input_type: "RetentionDeleteDispatchInput",
    output_type: "RetentionDeleteDispatchOutput",
    statements: RETENTION_DELETE_STATEMENTS,
    tables: RETENTION_DELETE_TABLES,
    row_codecs: &["sqlite_cache_ledger_row", "retention_delete_intent"],
    problem_kinds: RETENTION_PROBLEMS,
    data_classes: RETENTION_CLASSES,
    ledger_policy: Ledger::DeletesLedgerBackedRows,
    protection_policy: Protection::Mixed,
    stats_projection: Stats::Pressure,
};

pub const RETENTION_COMMANDS: &[Spec] =
    &[RETENTION_PLAN_COMMAND, RETENTION_DELETE_DISPATCH_COMMAND];

#[must_use]
pub fn retention_plan_output(plan: RetentionPlanInput) -> RetentionPlanOutput {
    crate::plan_retention(plan)
}
