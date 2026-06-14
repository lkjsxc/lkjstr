use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, UserTimelineDiscoveryInput,
    UserTimelineDiscoveryState, plan_user_timeline_discovery,
};

#[test]
fn user_timeline_discovery_does_not_treat_missing_routes_as_absence() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: Vec::new(),
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::Incomplete);
    assert_eq!(plan.reason_codes, vec!["no-route-groups"]);
    assert!(plan.retry_sources.is_empty());
    assert!(!plan.target_posts_only);
}

#[test]
fn user_timeline_discovery_names_pending_route_sources() {
    for (source, state) in [
        (
            DiscoveryRouteSource::TargetRoutes,
            UserTimelineDiscoveryState::LoadingTargetRoutes,
        ),
        (
            DiscoveryRouteSource::Nip65,
            UserTimelineDiscoveryState::LoadingNip65Routes,
        ),
        (
            DiscoveryRouteSource::Provenance,
            UserTimelineDiscoveryState::LoadingProvenanceRoutes,
        ),
    ] {
        let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
            groups: vec![group(source, DiscoveryRouteOutcome::Pending)],
            cache_checked: true,
            follow_list_found: false,
            target_posts_reachable: false,
            offline: false,
        });

        assert_eq!(plan.state, state);
        assert_eq!(plan.pending_sources, vec![source]);
        assert!(plan.reason_codes.is_empty());
    }
}

fn group(source: DiscoveryRouteSource, outcome: DiscoveryRouteOutcome) -> DiscoveryRouteGroup {
    DiscoveryRouteGroup {
        source,
        relays: vec!["wss://relay.example".to_owned()],
        outcome,
    }
}
