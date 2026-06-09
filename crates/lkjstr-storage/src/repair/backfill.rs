use serde::{Deserialize, Serialize};

use super::{RepairFinding, RepairFindingKind, RepairTargetState};
use crate::{CacheLedgerRecord, SqliteCacheLedgerRow};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairBackfillPlan {
    pub table_name: String,
    pub resource_id: String,
    pub target_state: RepairTargetState,
    pub protected: bool,
    pub known_owner: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ledger_record: Option<CacheLedgerRecord>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairBackfillInput {
    pub plans: Vec<RepairBackfillPlan>,
    pub apply: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairBackfillOutput {
    pub findings: Vec<RepairFinding>,
    pub planned_count: usize,
    pub applied_count: usize,
    pub skipped_count: usize,
}

#[must_use]
pub fn plan_repair_backfill(input: RepairBackfillInput) -> RepairBackfillOutput {
    let mut findings = Vec::new();
    let mut planned_count = 0;
    let mut applied_count = 0;
    let mut skipped_count = 0;
    for plan in input.plans {
        if !backfill_safe(&plan) {
            skipped_count += 1;
            findings.push(finding(RepairFindingKind::SkippedUnknownRow, &plan));
            continue;
        }
        planned_count += 1;
        findings.push(finding(RepairFindingKind::BackfillPlanned, &plan));
        if input.apply && plan.ledger_record.is_some() {
            applied_count += 1;
            findings.push(finding(RepairFindingKind::BackfillApplied, &plan));
        }
    }
    RepairBackfillOutput {
        findings,
        planned_count,
        applied_count,
        skipped_count,
    }
}

#[must_use]
pub fn repair_backfill_ledger_rows(input: &RepairBackfillInput) -> Vec<SqliteCacheLedgerRow> {
    if !input.apply {
        return Vec::new();
    }
    input
        .plans
        .iter()
        .filter(|plan| backfill_safe(plan))
        .filter_map(|plan| {
            plan.ledger_record
                .as_ref()
                .map(|ledger| crate::sqlite_cache_ledger_row_for_table(ledger, &plan.table_name))
        })
        .collect()
}

fn backfill_safe(plan: &RepairBackfillPlan) -> bool {
    plan.known_owner && !plan.protected && plan.target_state == RepairTargetState::Missing
}

fn finding(kind: RepairFindingKind, plan: &RepairBackfillPlan) -> RepairFinding {
    RepairFinding::new(kind, plan.table_name.clone(), plan.resource_id.clone())
}
