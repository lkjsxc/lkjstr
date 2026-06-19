use lkjstr_app::feed_scan::{
    CursorPoint, DEFAULT_INITIAL_SPAN_SECONDS, DEFAULT_MAX_SPAN_SECONDS, DEFAULT_MIN_SPAN_SECONDS,
    DEFAULT_STALE_HALF_LIFE_SECONDS, FeedScanHint, FeedScanPlanInput, ScanDirection,
    ScanHintStatus, ScanSpanConfig, ScanWindowFeedback, feed_scan_trace, plan_feed_scan,
};

const NOW_SECONDS: u64 = DEFAULT_STALE_HALF_LIFE_SECONDS * 20;

fn input(previous_hint: Option<FeedScanHint>) -> FeedScanPlanInput {
    FeedScanPlanInput {
        semantic_feed_key: "home:account:selected:policy".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        visible_edge: CursorPoint::new(NOW_SECONDS - 1000, "edge"),
        now_seconds: NOW_SECONDS,
        page_size: 100,
        requested_limit: 100,
        effective_limit: 100,
        previous_hint,
        scan_models: Vec::new(),
        span_config: ScanSpanConfig::default(),
        coverage_gaps: Vec::new(),
    }
}

fn hint(next_span_seconds: u64) -> FeedScanHint {
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
fn accepted_hint_is_visible_and_caps_the_next_span() {
    let scan_input = input(Some(hint(2400)));
    let plan = plan_feed_scan(&scan_input);
    let trace = feed_scan_trace(&scan_input, &plan, &[], None);

    assert_eq!(plan.hint_status, ScanHintStatus::Used);
    assert_eq!(trace.hint_status, ScanHintStatus::Used);
    assert!(trace.hint_used);
    assert!(plan.initial_span_seconds > DEFAULT_INITIAL_SPAN_SECONDS);
}

#[test]
fn expired_hint_is_reported_and_not_used_for_span_capping() {
    let mut stale = hint(2400);
    stale.expires_at_seconds = NOW_SECONDS;
    let plan = plan_feed_scan(&input(Some(stale)));

    assert_eq!(plan.hint_status, ScanHintStatus::Expired);
    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
}

#[test]
fn incompatible_hint_is_reported_and_not_used_for_span_capping() {
    let mut other_route = hint(2400);
    other_route.route_fingerprint = "route-b".to_owned();
    let plan = plan_feed_scan(&input(Some(other_route)));

    assert_eq!(plan.hint_status, ScanHintStatus::Rejected);
    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
}

#[test]
fn missing_hint_is_reported_as_unavailable() {
    let plan = plan_feed_scan(&input(None));

    assert_eq!(plan.hint_status, ScanHintStatus::Unavailable);
    assert_eq!(plan.initial_span_seconds, DEFAULT_INITIAL_SPAN_SECONDS);
}
