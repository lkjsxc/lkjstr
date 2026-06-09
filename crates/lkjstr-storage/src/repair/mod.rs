#![doc = "Conservative storage repair reporting model."]

mod backfill;
mod finding;
mod scan;

pub use backfill::{
    RepairBackfillInput, RepairBackfillOutput, RepairBackfillPlan, plan_repair_backfill,
};
pub use finding::{RepairFinding, RepairFindingKind};
pub use scan::{
    RepairInventoryReportInput, RepairInventoryReportOutput, RepairScanInput, RepairScanOutput,
    RepairScanRow, RepairTargetState, report_repair_inventory, scan_repair,
};
