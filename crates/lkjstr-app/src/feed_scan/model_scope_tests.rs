use super::*;

fn observation() -> ScanSegmentObservation {
    ScanSegmentObservation {
        semantic_feed_key: "home:account:selected".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kind:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        since_seconds: 0,
        until_seconds: 600,
        requested_limit: 100,
        effective_limit: 100,
        event_count: 20,
        unique_event_count: 20,
        final_visible_count: 20,
        event_limit_reached: false,
        eose: true,
        timeout: false,
        closed: false,
        auth: false,
        socket_error: false,
        bytes_sent: 0,
        bytes_received: 0,
        started_at_ms: 1,
        completed_at_ms: 2,
    }
}

#[test]
fn parent_model_keys_omit_exact_only_fields() {
    let route = scan_model_from_observation(
        &observation(),
        ScanModelScope::RouteGroup,
        &ScanSpanConfig::default(),
    );
    assert_eq!(route.key.semantic_feed_key, "home:account:selected");
    assert_eq!(route.key.route_group_key, "selected");
    assert_eq!(route.key.relay_url, "");
    assert_eq!(route.key.semantic_filter_key, "");
    assert_eq!(route.key.route_fingerprint, "");
}

#[test]
fn reducer_updates_all_parent_scopes() {
    let input = FeedScanPlanInput {
        semantic_feed_key: "home:account:selected".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kind:1".to_owned(),
        direction: ScanDirection::Older,
        route_fingerprint: "route-a".to_owned(),
        visible_edge: CursorPoint::new(600, "edge"),
        now_seconds: 600,
        page_size: 100,
        requested_limit: 100,
        effective_limit: 100,
        previous_hint: None,
        scan_models: Vec::new(),
        span_config: ScanSpanConfig::default(),
        coverage_gaps: Vec::new(),
    };
    let update = reduce_scan_observation(&input, &observation());
    let scopes = update
        .updated_models
        .iter()
        .map(|model| model.scope.clone())
        .collect::<Vec<_>>();
    assert!(scopes.contains(&ScanModelScope::Exact));
    assert!(scopes.contains(&ScanModelScope::RouteGroup));
    assert!(scopes.contains(&ScanModelScope::Global));
}
