use super::repository::OptimizerRepositoryStatement;
use super::scan_density_model_row::ScanDensityModelRecord;
use super::scan_model_key::{
    ScanModelContextRecord, scan_model_keys_for_context, scan_model_scope_rank,
    scan_model_storage_key,
};

pub const SCAN_MODEL_TABLES: &[&str] = &[
    "feed_scan_observations",
    "feed_scan_density_models",
    "feed_scan_decision_traces",
];

pub const SCAN_MODEL_REPOSITORY_STATEMENTS: &[OptimizerRepositoryStatement] = &[
    statement("feed_scan_observations.insert", "feed_scan_observations"),
    statement(
        "feed_scan_density_models.upsert",
        "feed_scan_density_models",
    ),
    statement(
        "feed_scan_density_models.select_context",
        "feed_scan_density_models",
    ),
    statement(
        "feed_scan_decision_traces.insert",
        "feed_scan_decision_traces",
    ),
    statement("optimizer.delete_by_retention", "feed_scan_observations"),
    statement("optimizer.inventory", "feed_scan_density_models"),
    statement("optimizer.repair_orphan_ledger", "feed_scan_density_models"),
];

#[must_use]
pub fn select_scan_models_for_context(
    rows: &[ScanDensityModelRecord],
    context: &ScanModelContextRecord,
) -> Vec<ScanDensityModelRecord> {
    let keys = scan_model_keys_for_context(context);
    let wanted = keys
        .iter()
        .filter_map(|key| scan_model_storage_key(key).ok())
        .collect::<Vec<_>>();
    let mut selected = rows
        .iter()
        .filter(|row| wanted.iter().any(|key| key == &row.model_key))
        .cloned()
        .collect::<Vec<_>>();
    selected.sort_by_key(|row| (scan_model_scope_rank(&row.scope), row.model_key.clone()));
    selected
}

#[must_use]
pub fn decayed_scan_model_confidence(
    row: &ScanDensityModelRecord,
    now_ms: u64,
    half_life_ms: u64,
) -> f64 {
    if half_life_ms == 0 || now_ms <= row.updated_at_ms {
        return row.sample_weight.max(0.0);
    }
    let age = now_ms.saturating_sub(row.updated_at_ms) as f64;
    row.sample_weight.max(0.0) * 0.5_f64.powf(age / half_life_ms as f64)
}

#[must_use]
pub fn optimizer_inventory_tables() -> Vec<&'static str> {
    super::repository::optimizer_tables()
        .iter()
        .copied()
        .chain(SCAN_MODEL_TABLES.iter().copied())
        .collect()
}

const fn statement(id: &'static str, table_name: &'static str) -> OptimizerRepositoryStatement {
    OptimizerRepositoryStatement { id, table_name }
}
