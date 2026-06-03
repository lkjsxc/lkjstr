use super::*;

const NOW_SECONDS: u64 = 10_000;
const EDGE_SECONDS: u64 = 9_000;

fn input(previous_hint: Option<FeedScanHint>) -> FeedScanPlanInput {
    FeedScanPlanInput {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        visible_edge: CursorPoint::new(EDGE_SECONDS, "edge"),
        now_seconds: NOW_SECONDS,
        page_size: 20,
        requested_limit: 20,
        previous_hint,
        coverage_gaps: Vec::new(),
    }
}

fn compatible_hint(next_span_seconds: u64) -> FeedScanHint {
    FeedScanHint {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        current_span_seconds: DEFAULT_INITIAL_SPAN_SECONDS,
        next_span_seconds,
        min_span_seconds: DEFAULT_MIN_SPAN_SECONDS,
        max_span_seconds: DEFAULT_MAX_SPAN_SECONDS,
        last_feedback: ScanWindowFeedback::Balanced,
        density_ewma: 0.5,
        complete_window_count: 1,
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: EDGE_SECONDS - DEFAULT_INITIAL_SPAN_SECONDS,
        last_until: EDGE_SECONDS,
        updated_at_seconds: NOW_SECONDS - 10,
        expires_at_seconds: NOW_SECONDS + 10,
    }
}

#[test]
fn scan_plan_without_hint_uses_sixty_seconds() {
    let plan = plan_feed_scan(&input(None));

    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
    assert_eq!(plan.source, ScanPlanSource::Neutral);
}

#[test]
fn scan_plan_uses_compatible_hint() {
    let plan = plan_feed_scan(&input(Some(compatible_hint(240))));

    assert_eq!(plan.initial_span_seconds, 240);
    assert_eq!(plan.source, ScanPlanSource::DurableHint);
}

#[test]
fn scan_plan_rejects_incompatible_route_fingerprint() {
    let mut hint = compatible_hint(240);
    hint.route_fingerprint = "other-route".to_owned();
    let plan = plan_feed_scan(&input(Some(hint)));

    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
    assert_eq!(plan.source, ScanPlanSource::IncompatibleHint);
    assert!(!plan.diagnostics.is_empty());
}

#[test]
fn scan_feedback_under_half_doubles_next_span() {
    let scan_input = input(None);
    let segment = ScanSegment::new(0, 60);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::UnderHalf);

    assert_eq!(update.next_hint.next_span_seconds, 120);
    assert_eq!(update.next_hint.complete_window_count, 1);
}

#[test]
fn scan_feedback_balanced_keeps_span() {
    let scan_input = input(None);
    let segment = ScanSegment::new(0, 60);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::Balanced);

    assert_eq!(update.next_hint.next_span_seconds, 60);
}

#[test]
fn scan_feedback_limit_hit_splits_near_visible_edge() {
    let scan_input = input(None);
    let segment = ScanSegment::new(0, 60);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::LimitHit);

    assert_eq!(update.next_hint.next_span_seconds, 30);
    assert_eq!(
        update.follow_up_segments.first(),
        Some(&ScanSegment::new(30, 60))
    );
    assert_eq!(
        update.follow_up_segments.get(1),
        Some(&ScanSegment::new(0, 30))
    );
}

#[test]
fn scan_feedback_incomplete_does_not_double() {
    let scan_input = input(None);
    let segment = ScanSegment::new(0, 60);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::Incomplete);

    assert_eq!(update.next_hint.next_span_seconds, 60);
    assert_eq!(update.next_hint.incomplete_window_count, 1);
}

#[test]
fn scan_feedback_minimum_limit_hit_becomes_unresolved() {
    let scan_input = input(None);
    let segment = ScanSegment::new(0, DEFAULT_MIN_SPAN_SECONDS);
    let update = reduce_scan_feedback(&scan_input, &segment, ScanWindowFeedback::LimitHit);

    assert!(update.unresolved);
    assert!(update.follow_up_segments.is_empty());
}

#[test]
fn scan_hint_never_proves_cache_absence() {
    assert!(!scan_hint_proves_cache_absence());
}

#[test]
fn scan_hint_does_not_suppress_uncovered_relay() {
    let gap = CoverageGap::new(1, 2, "selected", "wss://relay.example/", "kinds:1");

    assert!(should_query_uncovered_relay(&gap));
}

#[test]
fn scan_trace_reports_hint_and_feedback_counts() {
    let scan_input = input(Some(compatible_hint(120)));
    let plan = plan_feed_scan(&scan_input);
    let trace = feed_scan_trace(
        &scan_input,
        &plan,
        &[ScanWindowFeedback::UnderHalf, ScanWindowFeedback::LimitHit],
        Some(compatible_hint(240)),
    );

    assert!(trace.hint_used);
    assert_eq!(trace.initial_span_seconds, 120);
    assert_eq!(trace.segments_processed, 2);
    assert_eq!(trace.feedback_counts.under_half, 1);
    assert_eq!(trace.feedback_counts.limit_hit, 1);
    assert!(trace.next_hint.is_some());
}
