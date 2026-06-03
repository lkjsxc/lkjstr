use super::config::ScanSpanConfig;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SpanCapReason {
    IncreaseLimited,
    DecreaseLimited,
    MinSpan,
    MaxSpan,
}

#[must_use]
pub fn change_capped_span(
    bounded: u64,
    previous: u64,
    config: &ScanSpanConfig,
) -> (u64, Option<SpanCapReason>) {
    let factor = config.safe_change_factor();
    let min_change = ((previous as f64) / factor).floor().max(1.0) as u64;
    let max_change = ((previous as f64) * factor).ceil().max(1.0) as u64;
    let changed = bounded.clamp(min_change, max_change);
    let bounded_changed = config.bounded_span(changed);
    (
        bounded_changed,
        cap_reason(bounded, bounded_changed, min_change, max_change, config),
    )
}

#[must_use]
pub fn f64_to_span(raw_span: f64, fallback: u64) -> u64 {
    if !raw_span.is_finite() || raw_span <= 0.0 {
        fallback
    } else if raw_span >= u64::MAX as f64 {
        u64::MAX
    } else {
        raw_span.round() as u64
    }
}

fn cap_reason(
    bounded: u64,
    changed: u64,
    min_change: u64,
    max_change: u64,
    config: &ScanSpanConfig,
) -> Option<SpanCapReason> {
    if changed == config.min_span_seconds && bounded < config.min_span_seconds {
        Some(SpanCapReason::MinSpan)
    } else if changed == config.max_span_seconds && bounded > config.max_span_seconds {
        Some(SpanCapReason::MaxSpan)
    } else if bounded < min_change {
        Some(SpanCapReason::DecreaseLimited)
    } else if bounded > max_change {
        Some(SpanCapReason::IncreaseLimited)
    } else {
        None
    }
}
