use super::config::{DEFAULT_HINT_TTL_SECONDS, ScanSpanConfig};
use super::feedback::ScanWindowFeedback;
use super::hint::FeedScanHint;
use super::model::{ScanDensityModel, ScanModelScope};
use super::model_update::update_scan_density_model;
use super::observation::ScanSegmentObservation;
use super::planner::FeedScanPlanInput;
use super::proposal::{SpanProposal, propose_scan_span};
use super::segment::{ScanSegment, SegmentSplitOutcome, split_limit_hit_segment};

#[derive(Clone, Debug, PartialEq)]
pub struct ScanFeedbackUpdate {
    pub next_hint: FeedScanHint,
    pub follow_up_segments: Vec<ScanSegment>,
    pub unresolved: bool,
    pub updated_model: ScanDensityModel,
    pub proposal: SpanProposal,
}

pub fn reduce_scan_observation(
    input: &FeedScanPlanInput,
    observation: &ScanSegmentObservation,
) -> ScanFeedbackUpdate {
    let model =
        update_scan_density_model(None, observation, ScanModelScope::Exact, &input.span_config);
    let proposal = propose_scan_span(
        &super::planner::scan_model_context(input),
        std::slice::from_ref(&model),
        input.previous_hint.as_ref(),
        observation.effective_limit,
        observation.completed_at_ms,
        &input.span_config,
    );
    let segment = ScanSegment::new(observation.since_seconds, observation.until_seconds);
    let feedback = feedback_from_observation(observation, &input.span_config);
    let split = follow_up_segments(
        input,
        &segment,
        &feedback,
        input.span_config.min_span_seconds,
    );
    ScanFeedbackUpdate {
        next_hint: next_hint(input, &segment, feedback, &proposal),
        unresolved: matches!(split, SegmentSplitOutcome::Unresolved(_)),
        follow_up_segments: split_segments(split),
        updated_model: model,
        proposal,
    }
}

pub fn reduce_scan_feedback(
    input: &FeedScanPlanInput,
    segment: &ScanSegment,
    feedback: ScanWindowFeedback,
) -> ScanFeedbackUpdate {
    reduce_scan_observation(input, &observation_from_feedback(input, segment, feedback))
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
    proposal: &SpanProposal,
) -> FeedScanHint {
    FeedScanHint {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: input.direction.clone(),
        route_fingerprint: input.route_fingerprint.clone(),
        current_span_seconds: segment.span_seconds,
        next_span_seconds: proposal.span_seconds,
        min_span_seconds: input.span_config.min_span_seconds,
        max_span_seconds: input.span_config.max_span_seconds,
        last_feedback: feedback,
        density_ewma: proposal.estimated_density_events_per_second,
        complete_window_count: if proposal.confidence > 0.0 { 1 } else { 0 },
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: segment.since_seconds,
        last_until: segment.until_seconds,
        updated_at_seconds: input.now_seconds,
        expires_at_seconds: input.now_seconds.saturating_add(DEFAULT_HINT_TTL_SECONDS),
    }
}

fn feedback_from_observation(
    observation: &ScanSegmentObservation,
    config: &ScanSpanConfig,
) -> ScanWindowFeedback {
    if observation.event_limit_reached {
        ScanWindowFeedback::LimitHit
    } else if observation.is_incomplete() {
        ScanWindowFeedback::Incomplete
    } else if observation.final_visible_count < config.target_count(observation.effective_limit) {
        ScanWindowFeedback::UnderHalf
    } else {
        ScanWindowFeedback::Balanced
    }
}

fn observation_from_feedback(
    input: &FeedScanPlanInput,
    segment: &ScanSegment,
    feedback: ScanWindowFeedback,
) -> ScanSegmentObservation {
    let target = input.span_config.target_count(input.effective_limit);
    let final_count = feedback_count(&feedback, target, input.effective_limit);
    ScanSegmentObservation {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: input.direction.clone(),
        route_fingerprint: input.route_fingerprint.clone(),
        since_seconds: segment.since_seconds,
        until_seconds: segment.until_seconds,
        requested_limit: input.requested_limit,
        effective_limit: input.effective_limit,
        event_count: final_count,
        unique_event_count: final_count,
        final_visible_count: final_count,
        event_limit_reached: feedback == ScanWindowFeedback::LimitHit,
        eose: feedback != ScanWindowFeedback::Incomplete,
        timeout: feedback == ScanWindowFeedback::Incomplete,
        closed: false,
        auth: false,
        socket_error: false,
        bytes_sent: 0,
        bytes_received: 0,
        started_at_ms: input.now_seconds.saturating_mul(1000),
        completed_at_ms: input.now_seconds.saturating_mul(1000),
    }
}

fn feedback_count(feedback: &ScanWindowFeedback, target: u16, effective_limit: u16) -> u16 {
    match feedback {
        ScanWindowFeedback::LimitHit => effective_limit,
        ScanWindowFeedback::UnderHalf => target.saturating_sub(1).max(1),
        ScanWindowFeedback::Balanced => target,
        ScanWindowFeedback::Incomplete => 0,
    }
}
