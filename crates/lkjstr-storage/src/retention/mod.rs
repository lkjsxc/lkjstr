#![doc = "Pure cache-retention planning for ledger-backed resources."]

mod model;
mod plan;
mod row;

pub use model::{
    RetentionByteTarget, RetentionCandidate, RetentionDeleteIntent, RetentionDynamicProtection,
    RetentionPlan, RetentionPlanInput, RetentionPlanSummary, RetentionStopReason,
};
pub use plan::{
    candidate_is_dynamically_protected, candidate_is_prunable, plan_retention,
    retention_stop_reason,
};
pub use row::retention_candidate_from_ledger_row;
