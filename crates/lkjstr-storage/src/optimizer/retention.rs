use std::collections::BTreeSet;

use crate::CacheResourceKind;

use super::relay_observation_row::RelayReadObservationRecord;

pub const DEFAULT_OBSERVATION_MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1_000;
pub const DEFAULT_OBSERVATION_MAX_ROWS: usize = 2_000;
pub const DEFAULT_OPTIMIZER_SCORE_MAX_AGE_MS: u64 = 30 * 24 * 60 * 60 * 1_000;
pub const DEFAULT_SCAN_HINT_MAX_AGE_MS: u64 = 30 * 24 * 60 * 60 * 1_000;
pub const DEFAULT_ROUTE_EVIDENCE_MAX_AGE_MS: u64 = 30 * 24 * 60 * 60 * 1_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizerRetentionPolicy {
    pub observation_max_age_ms: u64,
    pub observation_max_rows: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizerRetentionPlan {
    pub delete_observation_ids: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OptimizerLedgerProbe {
    pub ledger_id: String,
    pub resource_kind: CacheResourceKind,
    pub resource_id: String,
}

impl Default for OptimizerRetentionPolicy {
    fn default() -> Self {
        Self {
            observation_max_age_ms: DEFAULT_OBSERVATION_MAX_AGE_MS,
            observation_max_rows: DEFAULT_OBSERVATION_MAX_ROWS,
        }
    }
}

#[must_use]
pub fn plan_optimizer_observation_retention(
    rows: &[RelayReadObservationRecord],
    now_ms: u64,
    policy: &OptimizerRetentionPolicy,
) -> OptimizerRetentionPlan {
    let cutoff = now_ms.saturating_sub(policy.observation_max_age_ms);
    let mut newest = rows.to_vec();
    newest.sort_by(|left, right| {
        right
            .created_at_ms
            .cmp(&left.created_at_ms)
            .then_with(|| left.id.cmp(&right.id))
    });
    let keep = newest
        .iter()
        .filter(|row| row.created_at_ms >= cutoff)
        .take(policy.observation_max_rows)
        .map(|row| row.id.clone())
        .collect::<BTreeSet<_>>();
    OptimizerRetentionPlan {
        delete_observation_ids: rows
            .iter()
            .filter(|row| !keep.contains(&row.id))
            .map(|row| row.id.clone())
            .collect(),
    }
}

#[must_use]
pub fn orphan_optimizer_ledger_ids(
    probes: &[OptimizerLedgerProbe],
    existing_resource_ids: &BTreeSet<String>,
) -> Vec<String> {
    probes
        .iter()
        .filter(|probe| optimizer_resource_kind(probe.resource_kind))
        .filter(|probe| !existing_resource_ids.contains(&probe.resource_id))
        .map(|probe| probe.ledger_id.clone())
        .collect()
}

#[must_use]
pub const fn optimizer_resource_kind(kind: CacheResourceKind) -> bool {
    matches!(
        kind,
        CacheResourceKind::RelayReadObservation
            | CacheResourceKind::RelayReadScore
            | CacheResourceKind::ScanHint
            | CacheResourceKind::RouteEvidenceScore
    )
}
