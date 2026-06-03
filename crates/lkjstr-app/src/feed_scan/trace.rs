use super::cursor::ScanDirection;
use super::feedback::{FeedbackCounts, ScanWindowFeedback};
use super::hint::FeedScanHint;
use super::planner::{FeedScanPlan, FeedScanPlanInput, ScanPlanSource};

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanTrace {
    pub semantic_feed_key: String,
    pub direction: ScanDirection,
    pub hint_used: bool,
    pub initial_span_seconds: u64,
    pub segments_processed: u16,
    pub feedback_counts: FeedbackCounts,
    pub next_hint: Option<FeedScanHint>,
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
        hint_used: plan.source == ScanPlanSource::DurableHint,
        initial_span_seconds: plan.initial_span_seconds,
        segments_processed: feedbacks.len().min(u16::MAX as usize) as u16,
        feedback_counts: feedbacks
            .iter()
            .fold(FeedbackCounts::default(), |counts, feedback| {
                counts.record(feedback)
            }),
        next_hint,
    }
}
