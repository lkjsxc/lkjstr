#![doc = "Optimizer storage row codecs and retention helpers."]

mod relay_observation_row;
mod relay_score_row;
mod repository;
mod retention;
mod route_evidence_row;
mod scan_decision_trace_row;
mod scan_density_model_row;
mod scan_hint_row;
mod scan_model_key;
mod scan_model_repository;
mod scan_observation_row;

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
pub use scan_decision_trace_row::{
    ScanDecisionTraceRecord, SqliteScanDecisionTraceRow, scan_decision_trace_from_sqlite_row,
    sqlite_scan_decision_trace_row,
};
pub use scan_density_model_row::{
    ScanDensityModelRecord, SqliteScanDensityModelRow, scan_density_model_from_sqlite_row,
    scan_density_model_storage_key, sqlite_scan_density_model_row,
};
pub use scan_hint_row::{
    OptimizerScanHintRecord, SqliteOptimizerScanHintRow, optimizer_scan_hint_from_sqlite_row,
    optimizer_scan_hint_key, sqlite_optimizer_scan_hint_row,
};
pub use scan_model_key::{
    OptimizerKeyProblem, ScanModelContextRecord, ScanModelKeyRecord, StoredScanModelScope,
    scan_model_key_for_scope, scan_model_keys_for_context, scan_model_scope_order,
    scan_model_scope_rank, scan_model_storage_key,
};
pub use scan_model_repository::{
    SCAN_MODEL_REPOSITORY_STATEMENTS, SCAN_MODEL_TABLES, decayed_scan_model_confidence,
    optimizer_inventory_tables, select_scan_models_for_context,
};
pub use scan_observation_row::{
    ScanObservationRecord, SqliteScanObservationRow, scan_observation_from_sqlite_row,
    sqlite_scan_observation_row,
};

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_scan;
