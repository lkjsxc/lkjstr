use serde::{Deserialize, Serialize};

use super::{RepairFinding, RepairFindingKind};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RepairTargetState {
    Present,
    Missing,
    Unavailable,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairScanRow {
    pub table_name: String,
    pub resource_id: String,
    pub ledger_state: RepairTargetState,
    pub target_state: RepairTargetState,
    pub protected: bool,
    pub known_owner: bool,
    pub decode_ok: bool,
    pub corrupt: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairScanInput {
    pub rows: Vec<RepairScanRow>,
    pub after_resource_id: Option<String>,
    pub limit: usize,
    pub inventory_complete: bool,
    pub temporary_memory_mode: bool,
    pub schema_matches: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairScanOutput {
    pub findings: Vec<RepairFinding>,
    pub scanned_count: usize,
    pub next_cursor: Option<String>,
    pub chunk_continues: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairInventoryReportInput {
    pub inventory_complete: bool,
    pub temporary_memory_mode: bool,
    pub table_count: usize,
    pub next_cursor: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairInventoryReportOutput {
    pub findings: Vec<RepairFinding>,
    pub table_count: usize,
    pub next_cursor: Option<String>,
}

#[must_use]
pub fn scan_repair(input: RepairScanInput) -> RepairScanOutput {
    let mut findings = scan_context_findings(&input);
    let start = scan_start(&input.rows, input.after_resource_id.as_deref());
    let limit = input.limit.max(1);
    let end = start.saturating_add(limit).min(input.rows.len());
    for row in &input.rows[start..end] {
        classify_row(row, &mut findings);
    }
    let chunk_continues = end < input.rows.len();
    if chunk_continues {
        findings.push(RepairFinding::new(
            RepairFindingKind::ChunkContinuation,
            "cache_ledger",
            input.rows[end - 1].resource_id.clone(),
        ));
    }
    RepairScanOutput {
        findings,
        scanned_count: end.saturating_sub(start),
        next_cursor: chunk_continues.then(|| input.rows[end - 1].resource_id.clone()),
        chunk_continues,
    }
}

#[must_use]
pub fn report_repair_inventory(input: RepairInventoryReportInput) -> RepairInventoryReportOutput {
    let mut findings = Vec::new();
    if !input.inventory_complete {
        findings.push(RepairFinding::new(
            RepairFindingKind::IncompleteInventory,
            "inventory",
            "storage",
        ));
    }
    if input.temporary_memory_mode {
        findings.push(RepairFinding::new(
            RepairFindingKind::TemporaryMemoryMode,
            "inventory",
            "storage",
        ));
    }
    if let Some(cursor) = &input.next_cursor {
        findings.push(RepairFinding::new(
            RepairFindingKind::ChunkContinuation,
            "inventory",
            cursor,
        ));
    }
    RepairInventoryReportOutput {
        findings,
        table_count: input.table_count,
        next_cursor: input.next_cursor,
    }
}

fn scan_context_findings(input: &RepairScanInput) -> Vec<RepairFinding> {
    let mut findings = Vec::new();
    if !input.schema_matches {
        findings.push(RepairFinding::new(
            RepairFindingKind::SchemaMismatch,
            "schema",
            "sqlite",
        ));
    }
    if input.temporary_memory_mode {
        findings.push(RepairFinding::new(
            RepairFindingKind::TemporaryMemoryMode,
            "cache_ledger",
            "storage",
        ));
    }
    if !input.inventory_complete {
        findings.push(RepairFinding::new(
            RepairFindingKind::IncompleteInventory,
            "cache_ledger",
            "storage",
        ));
    }
    findings
}

fn classify_row(row: &RepairScanRow, findings: &mut Vec<RepairFinding>) {
    if row.corrupt {
        push_row_finding(row, RepairFindingKind::CorruptRow, findings);
    }
    if !row.decode_ok {
        push_row_finding(row, RepairFindingKind::DecodeFailure, findings);
    }
    if !row.known_owner {
        push_row_finding(row, RepairFindingKind::UnknownUnownedRow, findings);
        push_row_finding(row, RepairFindingKind::SkippedUnknownRow, findings);
        return;
    }
    if row.ledger_state == RepairTargetState::Missing {
        push_row_finding(row, RepairFindingKind::OrphanResourceRow, findings);
    }
    match row.target_state {
        RepairTargetState::Missing => push_row_finding(
            row,
            if row.protected {
                RepairFindingKind::SkippedUnknownRow
            } else {
                RepairFindingKind::OrphanLedgerRow
            },
            findings,
        ),
        RepairTargetState::Unavailable => {
            push_row_finding(row, RepairFindingKind::IncompleteInventory, findings);
        }
        RepairTargetState::Present => {}
    }
}

fn push_row_finding(
    row: &RepairScanRow,
    kind: RepairFindingKind,
    findings: &mut Vec<RepairFinding>,
) {
    findings.push(RepairFinding::new(
        kind,
        row.table_name.clone(),
        row.resource_id.clone(),
    ));
}

fn scan_start(rows: &[RepairScanRow], after: Option<&str>) -> usize {
    after
        .and_then(|cursor| rows.iter().position(|row| row.resource_id == cursor))
        .map_or(0, |index| index + 1)
}
