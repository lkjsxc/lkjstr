#![doc = "Pure adaptive grouped feed scan planning."]

mod config;
mod coverage;
mod cursor;
mod diagnostic;
mod feedback;
mod hierarchy;
mod hint;
mod hint_update;
mod model;
mod model_update;
mod observation;
mod planner;
mod proposal;
mod segment;
mod span_cap;
mod trace;

pub use config::{
    DEFAULT_HINT_TTL_SECONDS, DEFAULT_INITIAL_SPAN_SECONDS, DEFAULT_MAX_SINGLE_CHANGE_FACTOR,
    DEFAULT_MAX_SPAN_SECONDS, DEFAULT_MIN_SPAN_SECONDS, DEFAULT_MINIMUM_DENSITY_PER_SECOND,
    DEFAULT_STALE_HALF_LIFE_SECONDS, DEFAULT_TARGET_LIMIT_DENOMINATOR,
    DEFAULT_TARGET_LIMIT_NUMERATOR, ScanSpanConfig,
};
pub use coverage::{CoverageGap, scan_hint_proves_cache_absence, should_query_uncovered_relay};
pub use cursor::{CursorPoint, ScanDirection};
pub use diagnostic::ScanPlanDiagnostic;
pub use feedback::{FeedbackCounts, ScanWindowFeedback, next_span_for_feedback};
pub use hierarchy::{
    ScanModelContext, model_matches_context, scan_model_key_for_scope, scan_model_keys_for_context,
    scan_model_scope_order, scan_model_scope_rank, scan_model_scope_weight,
    select_models_for_context,
};
pub use hint::{FeedScanHint, HintCompatibility, HintContext};
pub use hint_update::{ScanFeedbackUpdate, reduce_scan_feedback, reduce_scan_observation};
pub use model::{
    ScanDensityModel, ScanModelKey, ScanModelScope, decayed_sample_weight, empty_scan_density_model,
};
pub use model_update::{scan_model_from_observation, update_scan_density_model};
pub use observation::ScanSegmentObservation;
pub use planner::{
    FeedScanPlan, FeedScanPlanInput, MAX_SEGMENTS_PER_PLAN, ScanPlanSource, hint_context,
    plan_feed_scan, scan_model_context,
};
pub use proposal::{SpanProposal, propose_scan_span};
pub use segment::{ScanSegment, SegmentSplitOutcome, segment_from_edge, split_limit_hit_segment};
pub use span_cap::SpanCapReason;
pub use trace::{FeedScanTrace, feed_scan_trace};

#[cfg(test)]
mod model_scope_tests;
#[cfg(test)]
mod tests;
