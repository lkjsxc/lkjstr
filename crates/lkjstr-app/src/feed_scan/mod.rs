#![doc = "Pure adaptive grouped feed scan planning."]

mod coverage;
mod cursor;
mod feedback;
mod hint;
mod hint_update;
mod planner;
mod segment;
mod trace;

pub use coverage::{CoverageGap, scan_hint_proves_cache_absence, should_query_uncovered_relay};
pub use cursor::{CursorPoint, ScanDirection};
pub use feedback::{FeedbackCounts, ScanWindowFeedback, next_span_for_feedback};
pub use hint::{
    DEFAULT_HINT_TTL_SECONDS, DEFAULT_INITIAL_SPAN_SECONDS, DEFAULT_MAX_SPAN_SECONDS,
    DEFAULT_MIN_SPAN_SECONDS, FeedScanHint, HintCompatibility, HintContext,
};
pub use hint_update::{ScanFeedbackUpdate, reduce_scan_feedback};
pub use planner::{
    FeedScanPlan, FeedScanPlanInput, MAX_SEGMENTS_PER_PLAN, ScanPlanDiagnostic, ScanPlanSource,
    hint_context, plan_feed_scan,
};
pub use segment::{ScanSegment, SegmentSplitOutcome, segment_from_edge, split_limit_hit_segment};
pub use trace::{FeedScanTrace, feed_scan_trace};

#[cfg(test)]
mod tests;
