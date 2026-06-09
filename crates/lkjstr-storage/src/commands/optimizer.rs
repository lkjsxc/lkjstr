#![doc = "Optimizer storage command metadata."]

use crate::{
    StorageDataClass as Class, StorageOperation as Op, StorageProblemKind as Problem,
    commands::spec::{
        StorageCommandFamily as Family, StorageLedgerPolicy as Ledger,
        StorageProtectionPolicy as Protection, StorageRepositoryCommandSpec as Spec,
        StorageStatsProjection as Stats,
    },
};

const OPTIMIZER_READ: &[Problem] = &[Problem::OptimizerRecordDecodeFailed];
const OPTIMIZER_WRITE: &[Problem] = &[
    Problem::OptimizerRecordDecodeFailed,
    Problem::QuotaOrWriteFailed,
];
const DIAGNOSTICS: &[Class] = &[Class::DiagnosticsCache];

#[allow(clippy::too_many_arguments)]
const fn optimizer(
    id: &'static str,
    operation: Op,
    input_type: &'static str,
    output_type: &'static str,
    statements: &'static [&'static str],
    tables: &'static [&'static str],
    row_codecs: &'static [&'static str],
    problem_kinds: &'static [Problem],
) -> Spec {
    Spec {
        id,
        family: Family::Optimizer,
        operation,
        input_type,
        output_type,
        statements,
        tables,
        row_codecs,
        problem_kinds,
        data_classes: DIAGNOSTICS,
        ledger_policy: Ledger::None,
        protection_policy: Protection::RecoverableDiagnostics,
        stats_projection: Stats::Optimizer,
    }
}

#[rustfmt::skip]
pub const FEED_SCAN_OBSERVATION_INSERT_COMMAND: Spec = optimizer("optimizer.feed-scan-observation.insert", Op::Write, "FeedScanObservationInsertInput", "FeedScanObservationInsertOutput", &["feed_scan_observations.insert"], &["feed_scan_observations"], &["sqlite_scan_observation_row"], OPTIMIZER_WRITE);
#[rustfmt::skip]
pub const FEED_SCAN_DENSITY_MODEL_SELECT_CONTEXT_COMMAND: Spec = optimizer("optimizer.feed-scan-density-model.select-context", Op::Read, "FeedScanDensityModelSelectContextInput", "FeedScanDensityModelSelectContextOutput", &["feed_scan_density_models.select_context"], &["feed_scan_density_models"], &["scan_density_model_from_sqlite_row"], OPTIMIZER_READ);
#[rustfmt::skip]
pub const FEED_SCAN_DENSITY_MODEL_UPSERT_COMMAND: Spec = optimizer("optimizer.feed-scan-density-model.upsert", Op::Write, "FeedScanDensityModelUpsertInput", "FeedScanDensityModelUpsertOutput", &["feed_scan_density_models.upsert"], &["feed_scan_density_models"], &["sqlite_scan_density_model_row"], OPTIMIZER_WRITE);
#[rustfmt::skip]
pub const FEED_SCAN_DECISION_TRACE_INSERT_COMMAND: Spec = optimizer("optimizer.feed-scan-decision-trace.insert", Op::Write, "FeedScanDecisionTraceInsertInput", "FeedScanDecisionTraceInsertOutput", &["feed_scan_decision_traces.insert"], &["feed_scan_decision_traces"], &["sqlite_scan_decision_trace_row"], OPTIMIZER_WRITE);

pub const OPTIMIZER_COMMANDS: &[Spec] = &[
    FEED_SCAN_OBSERVATION_INSERT_COMMAND,
    FEED_SCAN_DENSITY_MODEL_SELECT_CONTEXT_COMMAND,
    FEED_SCAN_DENSITY_MODEL_UPSERT_COMMAND,
    FEED_SCAN_DECISION_TRACE_INSERT_COMMAND,
];
