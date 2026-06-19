use super::cursor::ScanDirection;
use super::feedback::{FeedbackCounts, ScanWindowFeedback};
use super::hint::{FeedScanHint, ScanHintStatus};
use super::model::ScanModelScope;
use super::planner::{FeedScanPlan, FeedScanPlanInput};

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanTrace {
    pub semantic_feed_key: String,
    pub direction: ScanDirection,
    pub hint_used: bool,
    pub hint_status: ScanHintStatus,
    pub initial_span_seconds: u64,
    pub segments_processed: u16,
    pub feedback_counts: FeedbackCounts,
    pub next_hint: Option<FeedScanHint>,
    pub source_scope: ScanModelScope,
    pub confidence: f64,
}

pub fn feed_scan_trace(
    input: &FeedScanPlanInput,
    plan: &FeedScanPlan,
    feedbacks: &[ScanWindowFeedback],
    next_hint: Option<FeedScanHint>,
) -> FeedScanTrace {
    FeedScanTrace {
        semantic_feed_key: input.semantic_feed_key.clone(),
        direction: input.direction.clone(),
        hint_used: plan.hint_status == ScanHintStatus::Used,
        hint_status: plan.hint_status,
        initial_span_seconds: plan.initial_span_seconds,
        segments_processed: feedbacks.len().min(u16::MAX as usize) as u16,
        feedback_counts: feedbacks
            .iter()
            .fold(FeedbackCounts::default(), |counts, feedback| {
                counts.record(feedback)
            }),
        next_hint,
        source_scope: plan.proposal.source_scope.clone(),
        confidence: plan.proposal.confidence,
    }
}
