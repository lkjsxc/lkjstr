use super::*;

fn group(source: DiscoveryRouteSource, outcome: DiscoveryRouteOutcome) -> DiscoveryRouteGroup {
    DiscoveryRouteGroup {
        source,
        relays: vec!["wss://relay.example".to_owned()],
        outcome,
    }
}

#[test]
fn cache_miss_starts_selected_relay_discovery() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![group(
            DiscoveryRouteSource::Selected,
            DiscoveryRouteOutcome::Pending,
        )],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(
        plan.state,
        UserTimelineDiscoveryState::LoadingSelectedRelays
    );
}

#[test]
fn target_posts_only_is_honest_and_retryable() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![group(
            DiscoveryRouteSource::Nip65,
            DiscoveryRouteOutcome::Failed,
        )],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: true,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::TargetPostsOnly);
    assert!(plan.target_posts_only);
    assert_eq!(plan.retry_sources, vec![DiscoveryRouteSource::Nip65]);
}

#[test]
fn incomplete_state_includes_reason_codes() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![group(
            DiscoveryRouteSource::Provenance,
            DiscoveryRouteOutcome::Attempted,
        )],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::Incomplete);
    assert_eq!(plan.reason_codes, vec!["incomplete-routes"]);
}

#[test]
fn failed_routes_are_bounded_for_retry() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![
            group(
                DiscoveryRouteSource::Selected,
                DiscoveryRouteOutcome::Failed,
            ),
            group(DiscoveryRouteSource::Nip65, DiscoveryRouteOutcome::Failed),
            group(
                DiscoveryRouteSource::Provenance,
                DiscoveryRouteOutcome::Failed,
            ),
            group(
                DiscoveryRouteSource::TargetRoutes,
                DiscoveryRouteOutcome::Failed,
            ),
            group(
                DiscoveryRouteSource::Discovery,
                DiscoveryRouteOutcome::Failed,
            ),
        ],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::Failed);
    assert_eq!(plan.retry_sources.len(), 4);
}

#[test]
fn auth_required_route_beats_generic_failure() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![
            group(
                DiscoveryRouteSource::Selected,
                DiscoveryRouteOutcome::Failed,
            ),
            group(
                DiscoveryRouteSource::Nip65,
                DiscoveryRouteOutcome::AuthRequired,
            ),
        ],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::AuthRequired);
    assert_eq!(
        plan.retry_sources,
        vec![DiscoveryRouteSource::Selected, DiscoveryRouteSource::Nip65]
    );
}

#[test]
fn rate_limited_route_beats_generic_failure() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![
            group(
                DiscoveryRouteSource::Selected,
                DiscoveryRouteOutcome::Failed,
            ),
            group(
                DiscoveryRouteSource::TargetRoutes,
                DiscoveryRouteOutcome::RateLimited,
            ),
        ],
        cache_checked: true,
        follow_list_found: false,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::RateLimited);
    assert_eq!(
        plan.retry_sources,
        vec![
            DiscoveryRouteSource::Selected,
            DiscoveryRouteSource::TargetRoutes
        ]
    );
}

#[test]
fn found_follow_list_preserves_partial_route_outcomes() {
    let plan = plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![
            group(DiscoveryRouteSource::Nip65, DiscoveryRouteOutcome::Failed),
            group(
                DiscoveryRouteSource::Provenance,
                DiscoveryRouteOutcome::Succeeded,
            ),
        ],
        cache_checked: true,
        follow_list_found: true,
        target_posts_reachable: false,
        offline: false,
    });

    assert_eq!(plan.state, UserTimelineDiscoveryState::Partial);
    assert_eq!(plan.failed_sources, vec![DiscoveryRouteSource::Nip65]);
    assert_eq!(
        plan.successful_sources,
        vec![DiscoveryRouteSource::Provenance]
    );
}
