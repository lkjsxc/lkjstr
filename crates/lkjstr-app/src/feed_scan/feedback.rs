use super::config::{DEFAULT_INITIAL_SPAN_SECONDS, ScanSpanConfig};

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
    let config = ScanSpanConfig {
        min_span_seconds,
        max_span_seconds,
        ..ScanSpanConfig::default()
    };
    let current = config.bounded_span(current_span_seconds);
    let proposed = match feedback {
        ScanWindowFeedback::LimitHit => density_like_limit_span(current, &config),
        ScanWindowFeedback::UnderHalf => grow_to_change_cap(current, &config),
        ScanWindowFeedback::Balanced => current,
        ScanWindowFeedback::Incomplete => incomplete_span(current, conservative_large_span_seconds),
    };
    config.bounded_span(proposed)
}

fn density_like_limit_span(current: u64, config: &ScanSpanConfig) -> u64 {
    let numerator = u64::from(config.target_limit_numerator.max(1));
    let denominator = u64::from(config.target_limit_denominator.max(1));
    current
        .saturating_mul(numerator)
        .div_ceil(denominator)
        .max(1)
}

fn grow_to_change_cap(current: u64, config: &ScanSpanConfig) -> u64 {
    ((current as f64) * config.safe_change_factor()).round() as u64
}

fn incomplete_span(current: u64, conservative_large_span_seconds: u64) -> u64 {
    let large = conservative_large_span_seconds.max(DEFAULT_INITIAL_SPAN_SECONDS);
    if current > large {
        current.div_ceil(2)
    } else {
        current
    }
}
