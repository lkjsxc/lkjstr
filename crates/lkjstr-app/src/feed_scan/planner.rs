use super::config::ScanSpanConfig;
use super::coverage::{CoverageGap, should_query_uncovered_relay};
use super::cursor::{CursorPoint, ScanDirection};
use super::diagnostic::ScanPlanDiagnostic;
use super::hierarchy::ScanModelContext;
use super::hint::{FeedScanHint, HintCompatibility, HintContext, ScanHintStatus};
use super::model::{ScanDensityModel, ScanModelScope};
use super::proposal::{SpanProposal, propose_scan_span};
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
    pub effective_limit: u16,
    pub previous_hint: Option<FeedScanHint>,
    pub scan_models: Vec<ScanDensityModel>,
    pub span_config: ScanSpanConfig,
    pub coverage_gaps: Vec<CoverageGap>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanPlanSource {
    Neutral,
    DensityModel(ScanModelScope),
}

#[derive(Clone, Debug, PartialEq)]
pub struct FeedScanPlan {
    pub segments: Vec<ScanSegment>,
    pub initial_span_seconds: u64,
    pub source: ScanPlanSource,
    pub hint_status: ScanHintStatus,
    pub diagnostics: Vec<ScanPlanDiagnostic>,
    pub proposal: SpanProposal,
}

pub fn plan_feed_scan(input: &FeedScanPlanInput) -> FeedScanPlan {
    let hint_context = hint_context(input);
    let hint_status = scan_hint_status(input.previous_hint.as_ref(), &hint_context);
    let previous_hint = if hint_status == ScanHintStatus::Used {
        input.previous_hint.as_ref()
    } else {
        None
    };
    let proposal = propose_scan_span(
        &scan_model_context(input),
        &input.scan_models,
        previous_hint,
        input.effective_limit,
        input.now_seconds.saturating_mul(1000),
        &input.span_config,
    );
    let root = segment_from_edge(&input.direction, &input.visible_edge, proposal.span_seconds);
    FeedScanPlan {
        segments: matching_gap_segments(input).unwrap_or_else(|| vec![root]),
        initial_span_seconds: proposal.span_seconds,
        source: source_from_proposal(&proposal),
        hint_status,
        diagnostics: proposal.diagnostics.clone(),
        proposal,
    }
}

pub fn scan_hint_status(
    previous_hint: Option<&FeedScanHint>,
    context: &HintContext,
) -> ScanHintStatus {
    match previous_hint.map(|hint| hint.compatibility(context)) {
        None => ScanHintStatus::Unavailable,
        Some(HintCompatibility::Compatible) => ScanHintStatus::Used,
        Some(HintCompatibility::Expired) => ScanHintStatus::Expired,
        Some(HintCompatibility::Incompatible) => ScanHintStatus::Rejected,
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

pub fn scan_model_context(input: &FeedScanPlanInput) -> ScanModelContext {
    ScanModelContext {
        semantic_feed_key: input.semantic_feed_key.clone(),
        route_group_key: input.route_group_key.clone(),
        relay_url: input.relay_url.clone(),
        semantic_filter_key: input.semantic_filter_key.clone(),
        direction: input.direction.clone(),
        route_fingerprint: input.route_fingerprint.clone(),
    }
}

fn source_from_proposal(proposal: &SpanProposal) -> ScanPlanSource {
    if proposal.source_scope == ScanModelScope::Neutral {
        ScanPlanSource::Neutral
    } else {
        ScanPlanSource::DensityModel(proposal.source_scope.clone())
    }
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
