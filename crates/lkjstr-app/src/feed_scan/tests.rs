use super::*;

const NOW_SECONDS: u64 = DEFAULT_STALE_HALF_LIFE_SECONDS * 20;
const NOW_MS: u64 = NOW_SECONDS * 1000;
const EDGE_SECONDS: u64 = NOW_SECONDS - 1000;

fn input(
    scan_models: Vec<ScanDensityModel>,
    previous_hint: Option<FeedScanHint>,
) -> FeedScanPlanInput {
    FeedScanPlanInput {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        visible_edge: CursorPoint::new(EDGE_SECONDS, "edge"),
        now_seconds: NOW_SECONDS,
        page_size: 100,
        requested_limit: 100,
        effective_limit: 100,
        previous_hint,
        scan_models,
        span_config: ScanSpanConfig::default(),
        coverage_gaps: Vec::new(),
    }
}

fn observation(final_count: u16, limit_hit: bool, eose: bool) -> ScanSegmentObservation {
    ScanSegmentObservation {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        since_seconds: 0,
        until_seconds: 600,
        requested_limit: 100,
        effective_limit: 100,
        event_count: final_count,
        unique_event_count: final_count,
        final_visible_count: final_count,
        event_limit_reached: limit_hit,
        eose,
        timeout: !eose,
        closed: false,
        auth: false,
        socket_error: false,
        bytes_sent: 20,
        bytes_received: 200,
        started_at_ms: NOW_MS - 200,
        completed_at_ms: NOW_MS,
    }
}

fn model(final_count: u16, limit_hit: bool, scope: ScanModelScope) -> ScanDensityModel {
    scan_model_from_observation(
        &observation(final_count, limit_hit, true),
        scope,
        &ScanSpanConfig::default(),
    )
}

fn compatible_hint(next_span_seconds: u64) -> FeedScanHint {
    FeedScanHint {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        current_span_seconds: 600,
        next_span_seconds,
        min_span_seconds: DEFAULT_MIN_SPAN_SECONDS,
        max_span_seconds: DEFAULT_MAX_SPAN_SECONDS,
        last_feedback: ScanWindowFeedback::Balanced,
        density_ewma: 0.5,
        complete_window_count: 1,
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: 0,
        last_until: 600,
        updated_at_seconds: NOW_SECONDS - 10,
        expires_at_seconds: NOW_SECONDS + 10,
    }
}

#[test]
fn scan_plan_without_model_uses_neutral_sixty_seconds() {
    let plan = plan_feed_scan(&input(Vec::new(), None));

    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
    assert_eq!(plan.source, ScanPlanSource::Neutral);
    assert_eq!(plan.proposal.source_scope, ScanModelScope::Neutral);
}

#[test]
fn limit_hit_uses_censored_density_not_halving() {
    let plan = plan_feed_scan(&input(vec![model(100, true, ScanModelScope::Exact)], None));

    assert!((390..=410).contains(&plan.initial_span_seconds));
    assert_eq!(plan.proposal.target_count, 66);
}

#[test]
fn sparse_complete_window_grows_from_density() {
    let plan = plan_feed_scan(&input(vec![model(20, false, ScanModelScope::Exact)], None));

    assert!((1900..=2050).contains(&plan.initial_span_seconds));
}

#[test]
fn very_sparse_window_is_capped_by_change_factor() {
    let plan = plan_feed_scan(&input(vec![model(1, false, ScanModelScope::Exact)], None));

    assert_eq!(plan.initial_span_seconds, 2400);
    assert_eq!(
        plan.proposal.cap_applied,
        Some(SpanCapReason::IncreaseLimited)
    );
}

#[test]
fn parent_model_is_used_when_exact_model_is_missing() {
    let plan = plan_feed_scan(&input(
        vec![model(20, false, ScanModelScope::RelayFilter)],
        None,
    ));

    assert_eq!(plan.proposal.source_scope, ScanModelScope::RelayFilter);
    assert_ne!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
    assert!(plan.proposal.confidence > 0.0);
}

#[test]
fn stale_exact_model_loses_to_fresh_parent_model() {
    let mut exact = model(100, true, ScanModelScope::Exact);
    exact.updated_at_ms = NOW_MS - DEFAULT_STALE_HALF_LIFE_SECONDS * 10 * 1000;
    let parent = model(20, false, ScanModelScope::RelayFilter);

    let plan = plan_feed_scan(&input(vec![exact, parent], None));

    assert_eq!(plan.proposal.source_scope, ScanModelScope::RelayFilter);
    assert!((1800..=2050).contains(&plan.initial_span_seconds));
}

#[test]
fn scan_feedback_limit_hit_splits_near_visible_edge() {
    let scan_input = input(Vec::new(), None);
    let segment = ScanSegment::new(0, 60);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::LimitHit);

    assert_eq!(
        update.follow_up_segments.first(),
        Some(&ScanSegment::new(30, 60))
    );
    assert_eq!(
        update.follow_up_segments.get(1),
        Some(&ScanSegment::new(0, 30))
    );
    assert!(update.next_hint.next_span_seconds > 0);
}

#[test]
fn incomplete_observation_reduces_confidence_without_absence_proof() {
    let scan_input = input(Vec::new(), None);
    let update = reduce_scan_observation(&scan_input, &observation(5, false, false));

    assert_eq!(update.updated_model.incomplete_window_count, 1);
    assert!(update.proposal.confidence < 0.2);
    assert!(!scan_hint_proves_cache_absence());
}

#[test]
fn scan_hint_does_not_suppress_uncovered_relay() {
    let gap = CoverageGap::new(1, 2, "selected", "wss://relay.example/", "kinds:1");

    assert!(should_query_uncovered_relay(&gap));
}

#[test]
fn scan_trace_reports_source_scope_and_feedback_counts() {
    let scan_input = input(vec![model(20, false, ScanModelScope::Exact)], None);
    let plan = plan_feed_scan(&scan_input);
    let trace = feed_scan_trace(
        &scan_input,
        &plan,
        &[ScanWindowFeedback::UnderHalf, ScanWindowFeedback::LimitHit],
        Some(compatible_hint(240)),
    );

    assert!(trace.hint_used);
    assert_eq!(trace.source_scope, ScanModelScope::Exact);
    assert_eq!(trace.feedback_counts.under_half, 1);
    assert_eq!(trace.feedback_counts.limit_hit, 1);
    assert!(trace.next_hint.is_some());
}
