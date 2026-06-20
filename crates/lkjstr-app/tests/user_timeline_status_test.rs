use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, FeedFragmentConfig,
    FeedViewRow, RowGeometryModel, UserTimelineDiscoveryInput, UserTimelineFeedSourceState,
    UserTimelineFeedStatus, UserTimelineFeedViewInput, build_user_timeline_feed_view,
    empty_feed_window, plan_user_timeline_discovery,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn user_timeline_incomplete_detail_names_attempts_without_absence() {
    let model = build_user_timeline_feed_view(UserTimelineFeedViewInput {
        owner: "timeline-tab".to_owned(),
        target_pubkey: Some("a".repeat(64)),
        discovery: plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
            groups: vec![
                DiscoveryRouteGroup {
                    source: DiscoveryRouteSource::Selected,
                    relays: vec!["wss://selected.example".to_owned()],
                    outcome: DiscoveryRouteOutcome::Attempted,
                },
                DiscoveryRouteGroup {
                    source: DiscoveryRouteSource::TargetRoutes,
                    relays: vec!["wss://target.example".to_owned()],
                    outcome: DiscoveryRouteOutcome::Failed,
                },
            ],
            cache_checked: true,
            follow_list_found: false,
            target_posts_reachable: false,
            offline: false,
        }),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Pending,
        selected_relays: vec!["wss://selected.example".to_owned()],
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
        diagnostics: Vec::new(),
    });

    assert_eq!(model.status, UserTimelineFeedStatus::Incomplete);
    assert!(
        model
            .status_detail
            .contains("tried selected relays and target routes")
    );
    assert!(model.status_detail.contains("target routes failed"));
    assert!(
        model
            .status_detail
            .contains("target-only posts unavailable")
    );
    assert!(model.status_detail.contains("retry or add target routes"));
    assert!(!model.status_detail.contains("follows nobody"));
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(
            row,
            FeedViewRow::Unavailable(item)
                if item.reason == "incomplete-user-timeline-discovery"
                    && item.retry_available
        )
    }));
}
