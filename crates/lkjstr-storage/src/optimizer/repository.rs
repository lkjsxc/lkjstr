#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OptimizerRepositoryStatement {
    pub id: &'static str,
    pub table_name: &'static str,
}

pub const OPTIMIZER_TABLES: &[&str] = &[
    "relay_read_observations",
    "relay_read_scores",
    "feed_scan_observations",
    "feed_scan_density_models",
    "feed_scan_hints",
    "feed_scan_decision_traces",
    "feed_row_height_observations",
    "feed_row_height_models",
    "route_evidence_scores",
];

pub const OPTIMIZER_REPOSITORY_STATEMENTS: &[OptimizerRepositoryStatement] = &[
    statement("relay_read_observations.insert", "relay_read_observations"),
    statement(
        "relay_read_observations.delete_old",
        "relay_read_observations",
    ),
    statement("relay_read_scores.upsert", "relay_read_scores"),
    statement("relay_read_scores.select", "relay_read_scores"),
    statement("feed_scan_observations.insert", "feed_scan_observations"),
    statement(
        "feed_scan_density_models.upsert",
        "feed_scan_density_models",
    ),
    statement(
        "feed_scan_density_models.select_context",
        "feed_scan_density_models",
    ),
    statement("feed_scan_hints.upsert", "feed_scan_hints"),
    statement("feed_scan_hints.compatible", "feed_scan_hints"),
    statement(
        "feed_scan_decision_traces.insert",
        "feed_scan_decision_traces",
    ),
    statement(
        "feed_row_height_observations.insert",
        "feed_row_height_observations",
    ),
    statement(
        "feed_row_height_observations.delete_before",
        "feed_row_height_observations",
    ),
    statement("feed_row_height_models.select", "feed_row_height_models"),
    statement("feed_row_height_models.upsert", "feed_row_height_models"),
    statement("route_evidence_scores.upsert", "route_evidence_scores"),
    statement("route_evidence_scores.by_author", "route_evidence_scores"),
];

#[must_use]
pub const fn optimizer_tables() -> &'static [&'static str] {
    OPTIMIZER_TABLES
}

#[must_use]
pub const fn optimizer_repository_statements() -> &'static [OptimizerRepositoryStatement] {
    OPTIMIZER_REPOSITORY_STATEMENTS
}

const fn statement(id: &'static str, table_name: &'static str) -> OptimizerRepositoryStatement {
    OptimizerRepositoryStatement { id, table_name }
}
