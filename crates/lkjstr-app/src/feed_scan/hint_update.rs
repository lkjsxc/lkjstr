use super::feedback::{ScanWindowFeedback, next_span_for_feedback};
use super::hint::{
    DEFAULT_HINT_TTL_SECONDS, DEFAULT_INITIAL_SPAN_SECONDS, DEFAULT_MAX_SPAN_SECONDS,
    DEFAULT_MIN_SPAN_SECONDS, FeedScanHint,
};
use super::planner::FeedScanPlanInput;
use super::segment::{ScanSegment, SegmentSplitOutcome, split_limit_hit_segment};

#[derive(Clone, Debug, PartialEq)]
pub struct ScanFeedbackUpdate {
    pub next_hint: FeedScanHint,
    pub follow_up_segments: Vec<ScanSegment>,
    pub unresolved: bool,
}

pub fn reduce_scan_feedback(
    input: &FeedScanPlanInput,
    segment: &ScanSegment,
    feedback: ScanWindowFeedback,
) -> ScanFeedbackUpdate {
    let min_span = input
        .previous_hint
        .as_ref()
        .map(|hint| hint.min_span_seconds)
        .unwrap_or(DEFAULT_MIN_SPAN_SECONDS);
    let max_span = input
        .previous_hint
        .as_ref()
        .map(|hint| hint.max_span_seconds)
        .unwrap_or(DEFAULT_MAX_SPAN_SECONDS);
    let next_span = next_span_for_feedback(
        &feedback,
        segment.span_seconds,
        min_span,
        max_span,
        DEFAULT_INITIAL_SPAN_SECONDS,
    );
    let split = follow_up_segments(input, segment, &feedback, min_span);
    ScanFeedbackUpdate {
        next_hint: next_hint(input, segment, feedback, next_span, min_span, max_span),
        unresolved: matches!(split, SegmentSplitOutcome::Unresolved(_)),
        follow_up_segments: split_segments(split),
    }
}

fn follow_up_segments(
    input: &FeedScanPlanInput,
    segment: &ScanSegment,
    feedback: &ScanWindowFeedback,
    min_span_seconds: u64,
) -> SegmentSplitOutcome {
    if feedback == &ScanWindowFeedback::LimitHit {
        split_limit_hit_segment(segment, &input.direction, min_span_seconds)
    } else {
        SegmentSplitOutcome::Split(Vec::new())
    }
}

fn split_segments(outcome: SegmentSplitOutcome) -> Vec<ScanSegment> {
    match outcome {
        SegmentSplitOutcome::Split(segments) => segments,
        SegmentSplitOutcome::Unresolved(_) => Vec::new(),
    }
}

fn next_hint(
    input: &FeedScanPlanInput,
    segment: &ScanSegment,
    feedback: ScanWindowFeedback,
    next_span_seconds: u64,
    min_span_seconds: u64,
    max_span_seconds: u64,
) -> FeedScanHint {
    FeedScanHint {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: input.direction.clone(),
        route_fingerprint: input.route_fingerprint.clone(),
        current_span_seconds: segment.span_seconds,
        next_span_seconds,
        min_span_seconds,
        max_span_seconds,
        last_feedback: feedback.clone(),
        density_ewma: density_for_feedback(&feedback),
        complete_window_count: complete_count(&feedback),
        dense_window_count: dense_count(&feedback),
        incomplete_window_count: incomplete_count(&feedback),
        last_since: segment.since_seconds,
        last_until: segment.until_seconds,
        updated_at_seconds: input.now_seconds,
        expires_at_seconds: input.now_seconds.saturating_add(DEFAULT_HINT_TTL_SECONDS),
    }
}

fn density_for_feedback(feedback: &ScanWindowFeedback) -> f64 {
    match feedback {
        ScanWindowFeedback::LimitHit => 1.0,
        ScanWindowFeedback::Balanced => 0.5,
        ScanWindowFeedback::UnderHalf | ScanWindowFeedback::Incomplete => 0.0,
    }
}

fn complete_count(feedback: &ScanWindowFeedback) -> u64 {
    match feedback {
        ScanWindowFeedback::UnderHalf | ScanWindowFeedback::Balanced => 1,
        ScanWindowFeedback::LimitHit | ScanWindowFeedback::Incomplete => 0,
    }
}

fn dense_count(feedback: &ScanWindowFeedback) -> u64 {
    if feedback == &ScanWindowFeedback::LimitHit {
        1
    } else {
        0
    }
}

fn incomplete_count(feedback: &ScanWindowFeedback) -> u64 {
    if feedback == &ScanWindowFeedback::Incomplete {
        1
    } else {
        0
    }
}
