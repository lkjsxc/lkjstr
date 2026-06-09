#![doc = "Conservative storage repair reporting model."]

mod backfill;
mod finding;
mod probe;
mod scan;

pub use backfill::{
    RepairBackfillInput, RepairBackfillOutput, RepairBackfillPlan, plan_repair_backfill,
    repair_backfill_ledger_rows,
};
pub use finding::{RepairFinding, RepairFindingKind};
pub use probe::{
    RepairProbeHit, RepairTargetProbe, RepairTargetProbeBatch, RepairTargetProbeInput,
    RepairTargetProbeOutput, finish_repair_target_probe, repair_probe_row,
    repair_probe_statement_id, repair_target_probe_batch,
};
pub use scan::{
    RepairInventoryReportInput, RepairInventoryReportOutput, RepairScanInput, RepairScanOutput,
    RepairScanRow, RepairTargetState, report_repair_inventory, scan_repair,
};
