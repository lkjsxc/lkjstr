#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OptimizerRepositoryStatement {
    pub id: &'static str,
    pub table_name: &'static str,
}

pub const OPTIMIZER_TABLES: &[&str] = &[
    "relay_read_observations",
    "relay_read_scores",
    "feed_scan_hints",
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
    statement("feed_scan_hints.upsert", "feed_scan_hints"),
    statement("feed_scan_hints.compatible", "feed_scan_hints"),
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
