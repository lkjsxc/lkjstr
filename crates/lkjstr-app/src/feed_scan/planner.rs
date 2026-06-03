use super::coverage::{CoverageGap, should_query_uncovered_relay};
use super::cursor::{CursorPoint, ScanDirection};
use super::hint::{DEFAULT_INITIAL_SPAN_SECONDS, FeedScanHint, HintCompatibility, HintContext};
use super::segment::{ScanSegment, segment_from_edge};

pub const MAX_SEGMENTS_PER_PLAN: usize = 96;

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanPlanInput {
    pub semantic_feed_key: String,
    pub route_group_key: String,
    pub relay_url: String,
    pub semantic_filter_key: String,
    pub direction: ScanDirection,
    pub route_fingerprint: String,
    pub visible_edge: CursorPoint,
    pub now_seconds: u64,
    pub page_size: u16,
    pub requested_limit: u16,
    pub previous_hint: Option<FeedScanHint>,
    pub coverage_gaps: Vec<CoverageGap>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanPlanSource {
    Neutral,
    DurableHint,
    ExpiredHint,
    IncompatibleHint,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanPlanDiagnostic {
    pub message: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanPlan {
    pub segments: Vec<ScanSegment>,
    pub initial_span_seconds: u64,
    pub source: ScanPlanSource,
    pub diagnostics: Vec<ScanPlanDiagnostic>,
}

pub fn plan_feed_scan(input: &FeedScanPlanInput) -> FeedScanPlan {
    let (source, initial_span_seconds, diagnostics) = initial_span(input);
    let root = segment_from_edge(&input.direction, &input.visible_edge, initial_span_seconds);
    FeedScanPlan {
        segments: matching_gap_segments(input).unwrap_or_else(|| vec![root]),
        initial_span_seconds,
        source,
        diagnostics,
    }
}

pub fn hint_context(input: &FeedScanPlanInput) -> HintContext {
    HintContext {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: input.direction.clone(),
        route_fingerprint: input.route_fingerprint.clone(),
        now_seconds: input.now_seconds,
    }
}

fn initial_span(input: &FeedScanPlanInput) -> (ScanPlanSource, u64, Vec<ScanPlanDiagnostic>) {
    let Some(hint) = &input.previous_hint else {
        return (
            ScanPlanSource::Neutral,
            DEFAULT_INITIAL_SPAN_SECONDS,
            Vec::new(),
        );
    };
    match hint.compatibility(&hint_context(input)) {
        HintCompatibility::Compatible => (
            ScanPlanSource::DurableHint,
            hint.bounded_next_span(),
            Vec::new(),
        ),
        HintCompatibility::Expired => {
            diagnostic_source(ScanPlanSource::ExpiredHint, "scan hint expired")
        }
        HintCompatibility::Incompatible => {
            diagnostic_source(ScanPlanSource::IncompatibleHint, "scan hint incompatible")
        }
    }
}

fn diagnostic_source(
    source: ScanPlanSource,
    message: &str,
) -> (ScanPlanSource, u64, Vec<ScanPlanDiagnostic>) {
    (
        source,
        DEFAULT_INITIAL_SPAN_SECONDS,
        vec![ScanPlanDiagnostic {
            message: message.to_owned(),
        }],
    )
}

fn matching_gap_segments(input: &FeedScanPlanInput) -> Option<Vec<ScanSegment>> {
    let segments: Vec<ScanSegment> = input
        .coverage_gaps
        .iter()
        .filter(|gap| gap.route_group_key == input.route_group_key)
        .filter(|gap| gap.relay_url == input.relay_url)
        .filter(|gap| gap.semantic_filter_key == input.semantic_filter_key)
        .filter(|gap| should_query_uncovered_relay(gap))
        .take(MAX_SEGMENTS_PER_PLAN)
        .map(|gap| ScanSegment::new(gap.since_seconds, gap.until_seconds))
        .collect();
    if segments.is_empty() {
        None
    } else {
        Some(segments)
    }
}
