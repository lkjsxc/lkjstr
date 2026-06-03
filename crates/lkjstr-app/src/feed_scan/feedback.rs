#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanWindowFeedback {
    LimitHit,
    UnderHalf,
    Balanced,
    Incomplete,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct FeedbackCounts {
    pub limit_hit: u16,
    pub under_half: u16,
    pub balanced: u16,
    pub incomplete: u16,
}

impl FeedbackCounts {
    pub fn record(&self, feedback: &ScanWindowFeedback) -> Self {
        let mut next = self.clone();
        match feedback {
            ScanWindowFeedback::LimitHit => next.limit_hit = next.limit_hit.saturating_add(1),
            ScanWindowFeedback::UnderHalf => next.under_half = next.under_half.saturating_add(1),
            ScanWindowFeedback::Balanced => next.balanced = next.balanced.saturating_add(1),
            ScanWindowFeedback::Incomplete => next.incomplete = next.incomplete.saturating_add(1),
        }
        next
    }
}

pub fn next_span_for_feedback(
    feedback: &ScanWindowFeedback,
    current_span_seconds: u64,
    min_span_seconds: u64,
    max_span_seconds: u64,
    conservative_large_span_seconds: u64,
) -> u64 {
    let bounded_current = current_span_seconds.clamp(min_span_seconds, max_span_seconds);
    match feedback {
        ScanWindowFeedback::UnderHalf => bounded_current.saturating_mul(2).min(max_span_seconds),
        ScanWindowFeedback::Balanced => bounded_current,
        ScanWindowFeedback::LimitHit => (bounded_current / 2).max(min_span_seconds),
        ScanWindowFeedback::Incomplete => incomplete_next_span(
            bounded_current,
            min_span_seconds,
            conservative_large_span_seconds,
        ),
    }
}

fn incomplete_next_span(
    current_span_seconds: u64,
    min_span_seconds: u64,
    conservative_large_span_seconds: u64,
) -> u64 {
    if current_span_seconds > conservative_large_span_seconds {
        (current_span_seconds / 2).max(min_span_seconds)
    } else {
        current_span_seconds.max(min_span_seconds)
    }
}
