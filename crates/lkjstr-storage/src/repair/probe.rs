use serde::{Deserialize, Serialize};

use super::{RepairFinding, RepairFindingKind, RepairScanRow, RepairTargetState, scan_repair};
use crate::CacheResourceKind;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairTargetProbe {
    pub resource_kind: CacheResourceKind,
    pub table_name: String,
    pub resource_id: String,
    pub ledger_state: RepairTargetState,
    pub protected: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairTargetProbeInput {
    pub targets: Vec<RepairTargetProbe>,
    pub after_resource_id: Option<String>,
    pub limit: usize,
    pub inventory_complete: bool,
    pub temporary_memory_mode: bool,
    pub schema_matches: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairTargetProbeOutput {
    pub findings: Vec<RepairFinding>,
    pub rows: Vec<RepairScanRow>,
    pub scanned_count: usize,
    pub next_cursor: Option<String>,
    pub chunk_continues: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairProbeHit {
    pub probe_present: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepairTargetProbeBatch {
    pub targets: Vec<RepairTargetProbe>,
    pub next_cursor: Option<String>,
    pub chunk_continues: bool,
}

#[must_use]
pub fn repair_probe_statement_id(target: &RepairTargetProbe) -> Option<&'static str> {
    let (table_name, statement_id) = route_for_kind(target.resource_kind)?;
    (target.table_name == table_name).then_some(statement_id)
}

#[must_use]
pub fn repair_target_probe_batch(input: &RepairTargetProbeInput) -> RepairTargetProbeBatch {
    let start = probe_start(&input.targets, input.after_resource_id.as_deref());
    let limit = input.limit.max(1);
    let end = start.saturating_add(limit).min(input.targets.len());
    let targets = input.targets[start..end].to_vec();
    let chunk_continues = end < input.targets.len();
    RepairTargetProbeBatch {
        next_cursor: chunk_continues.then(|| input.targets[end - 1].resource_id.clone()),
        targets,
        chunk_continues,
    }
}

#[must_use]
pub fn repair_probe_row(
    target: &RepairTargetProbe,
    target_state: RepairTargetState,
    decode_ok: bool,
    corrupt: bool,
) -> RepairScanRow {
    RepairScanRow {
        table_name: target.table_name.clone(),
        resource_id: target.resource_id.clone(),
        ledger_state: target.ledger_state,
        target_state,
        protected: target.protected,
        known_owner: repair_probe_statement_id(target).is_some(),
        decode_ok,
        corrupt,
    }
}

#[must_use]
pub fn finish_repair_target_probe(
    input: RepairTargetProbeInput,
    rows: Vec<RepairScanRow>,
) -> RepairTargetProbeOutput {
    let batch = repair_target_probe_batch(&input);
    let mut scan = scan_repair(super::RepairScanInput {
        rows: rows.clone(),
        after_resource_id: None,
        limit: rows.len().max(1),
        inventory_complete: input.inventory_complete,
        temporary_memory_mode: input.temporary_memory_mode,
        schema_matches: input.schema_matches,
    });
    if batch.chunk_continues {
        push_chunk_finding(&mut scan.findings, &batch);
    }
    RepairTargetProbeOutput {
        findings: scan.findings,
        rows,
        scanned_count: batch.targets.len(),
        next_cursor: batch.next_cursor,
        chunk_continues: batch.chunk_continues,
    }
}

fn route_for_kind(kind: CacheResourceKind) -> Option<(&'static str, &'static str)> {
    match kind {
        CacheResourceKind::NostrEvent => Some(("events", "events.repair_probe")),
        CacheResourceKind::NotificationRecord => {
            Some(("notifications", "notifications.repair_probe"))
        }
        CacheResourceKind::FeedCursor => Some(("feed_cursors", "feed_cursors.repair_probe")),
        CacheResourceKind::CoverageRow => Some(("feed_coverage", "feed_coverage.repair_probe")),
        CacheResourceKind::ScanHint => Some(("feed_scan_hints", "feed_scan_hints.repair_probe")),
        CacheResourceKind::RelaySummary => Some((
            "relay_diagnostic_summaries",
            "relay_diagnostic_summaries.repair_probe",
        )),
        CacheResourceKind::RelayInfo => {
            Some(("relay_information", "relay_information.repair_probe"))
        }
        CacheResourceKind::RelayReadObservation => Some((
            "relay_read_observations",
            "relay_read_observations.repair_probe",
        )),
        CacheResourceKind::RelayReadScore => {
            Some(("relay_read_scores", "relay_read_scores.repair_probe"))
        }
        CacheResourceKind::RelayListSuggestion => Some((
            "relay_list_suggestions",
            "relay_list_suggestions.repair_probe",
        )),
        CacheResourceKind::AuthorRelayRoute => {
            Some(("author_relay_routes", "author_relay_routes.repair_probe"))
        }
        CacheResourceKind::RouteEvidenceScore => Some((
            "route_evidence_scores",
            "route_evidence_scores.repair_probe",
        )),
        CacheResourceKind::JobRecord => Some(("jobs", "jobs.repair_probe")),
        CacheResourceKind::TabState
        | CacheResourceKind::ScanObservation
        | CacheResourceKind::ScanDensityModel
        | CacheResourceKind::ScanDecisionTrace => None,
    }
}

fn push_chunk_finding(findings: &mut Vec<RepairFinding>, batch: &RepairTargetProbeBatch) {
    if let Some(cursor) = &batch.next_cursor {
        findings.push(RepairFinding::new(
            RepairFindingKind::ChunkContinuation,
            "cache_ledger",
            cursor,
        ));
    }
}

fn probe_start(targets: &[RepairTargetProbe], after: Option<&str>) -> usize {
    after
        .and_then(|cursor| targets.iter().position(|row| row.resource_id == cursor))
        .map_or(0, |index| index + 1)
}
