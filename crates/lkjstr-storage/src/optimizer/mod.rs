#![doc = "Optimizer storage row codecs and retention helpers."]

mod relay_observation_row;
mod relay_score_row;
mod repository;
mod retention;
mod route_evidence_row;
mod scan_hint_row;

pub use relay_observation_row::{
    RelayReadObservationRecord, SqliteRelayReadObservationRow,
    relay_read_observation_from_sqlite_row, sqlite_relay_read_observation_row,
};
pub use relay_score_row::{
    RelayReadScoreRecord, SqliteRelayReadScoreRow, relay_read_score_from_sqlite_row,
    relay_read_score_key, sqlite_relay_read_score_row,
};
pub use repository::{
    OPTIMIZER_REPOSITORY_STATEMENTS, OPTIMIZER_TABLES, OptimizerRepositoryStatement,
    optimizer_repository_statements, optimizer_tables,
};
pub use retention::{
    DEFAULT_OBSERVATION_MAX_AGE_MS, DEFAULT_OBSERVATION_MAX_ROWS,
    DEFAULT_OPTIMIZER_SCORE_MAX_AGE_MS, DEFAULT_ROUTE_EVIDENCE_MAX_AGE_MS,
    DEFAULT_SCAN_HINT_MAX_AGE_MS, OptimizerLedgerProbe, OptimizerRetentionPlan,
    OptimizerRetentionPolicy, optimizer_resource_kind, orphan_optimizer_ledger_ids,
    plan_optimizer_observation_retention,
};
pub use route_evidence_row::{
    RouteEvidenceScoreRecord, SqliteRouteEvidenceScoreRow, route_evidence_score_from_sqlite_row,
    route_evidence_score_key, sqlite_route_evidence_score_row,
};
pub use scan_hint_row::{
    OptimizerKeyProblem, OptimizerScanHintRecord, SqliteOptimizerScanHintRow,
    optimizer_scan_hint_from_sqlite_row, optimizer_scan_hint_key, sqlite_optimizer_scan_hint_row,
};

#[cfg(test)]
mod tests;
