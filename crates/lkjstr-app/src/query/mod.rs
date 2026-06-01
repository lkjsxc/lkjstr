#![doc = "Pure app-level query demand planning."]

mod planner;
mod types;

pub use planner::plan_query_demand;
pub use types::{QueryDemandInput, QueryDemandPlan, QuerySurface};
