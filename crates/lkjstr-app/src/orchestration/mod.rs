#![doc = "Pure browser-local orchestration decisions."]

mod context;
mod decision;
mod evidence;
mod policy;
mod trace;

pub use context::{OrchestrationContext, SurfaceKind};
pub use decision::{
    CacheReadMode, FeedPrefetchPlan, HydrationPlan, RetentionHintPlan, SurfaceReadPlan,
    plan_cache_retention, plan_feed_prefetch, plan_hydration, plan_surface_read,
};
pub use evidence::{CoverageEvidenceState, OptimizerEvidenceState};
pub use policy::OrchestrationPolicy;
pub use trace::OrchestrationDecisionTrace;

#[cfg(test)]
mod tests;
