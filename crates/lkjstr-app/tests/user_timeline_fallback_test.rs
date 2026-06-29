use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, FeedDiagnosticSeverity,
    FeedFragmentConfig, FeedViewRow, RowGeometryModel, UserTimelineDiscoveryInput,
    UserTimelineFeedDiagnosticInput, UserTimelineFeedSourceState, UserTimelineFeedStatus,
    UserTimelineFeedViewInput, build_user_timeline_feed_view, empty_feed_window,
    plan_user_timeline_discovery,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn user_timeline_partial_failure_keeps_fallback_relays() -> Result<(), String> {
    let relay = "wss://fallback.example".to_owned();
    let model = build_user_timeline_feed_view(input(vec![relay.clone()]));

    assert_eq!(model.status, UserTimelineFeedStatus::Partial);
    assert!(model.live_query.is_some());
    let query = model.live_query.ok_or("missing live query")?;
    assert_eq!(query.selected_relays, vec![relay]);
    assert_eq!(query.authors, vec![pubkey("a")]);
    assert!(model.view_model.rows.iter().all(|row| {
        !matches!(row, FeedViewRow::Unavailable(item) if item.reason == "no-user-timeline-relay")
    }));
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "partial-user-timeline")
    }));
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Diagnostic(item) if item.diagnostic_id == "relay-settings")
    }));
    Ok(())
}

#[test]
fn user_timeline_without_any_route_reports_no_relay() {
    let model = build_user_timeline_feed_view(input(Vec::new()));

    assert_eq!(model.status, UserTimelineFeedStatus::NoEnabledRelay);
    assert!(model.live_query.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "no-user-timeline-relay")
    }));
}

fn input(selected_relays: Vec<String>) -> UserTimelineFeedViewInput {
    UserTimelineFeedViewInput {
        owner: "timeline-tab".to_owned(),
        target_pubkey: Some(pubkey("a")),
        discovery: plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
            groups: vec![DiscoveryRouteGroup {
                source: DiscoveryRouteSource::Selected,
                relays: selected_relays.clone(),
                outcome: DiscoveryRouteOutcome::Succeeded,
            }],
            cache_checked: true,
            follow_list_found: true,
            target_posts_reachable: false,
            offline: false,
        }),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Partial {
            reason: "Cached User Timeline follow list unavailable: opfs-owner-held".to_owned(),
            retry_available: true,
        },
        selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: vec![UserTimelineFeedDiagnosticInput {
            scope: "user-timeline-provider".to_owned(),
            id: "relay-settings".to_owned(),
            severity: FeedDiagnosticSeverity::Warning,
            message: "Relay settings unavailable: opfs-owner-held".to_owned(),
        }],
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
