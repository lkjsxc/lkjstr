use std::collections::{BTreeMap, BTreeSet};

use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource,
    UserTimelineDiscoveryInput, UserTimelineDiscoveryPlan, plan_user_timeline_discovery,
};
use lkjstr_relays::{AuthorRelayRoute, RouteEvidenceSource};

use crate::user_timeline_relay_outcome::{
    UserTimelineRelayOutcome, discovery_outcome_for_relays,
};

pub(crate) fn discovery_plan(
    selected_relays: Vec<String>,
    author_routes: &[AuthorRelayRoute],
    outcome: DiscoveryRouteOutcome,
    follow_list_found: bool,
) -> UserTimelineDiscoveryPlan {
    discovery_plan_with_target_posts(
        selected_relays,
        author_routes,
        outcome,
        follow_list_found,
        false,
    )
}

pub(crate) fn discovery_plan_with_target_posts(
    selected_relays: Vec<String>,
    author_routes: &[AuthorRelayRoute],
    outcome: DiscoveryRouteOutcome,
    follow_list_found: bool,
    target_posts_reachable: bool,
) -> UserTimelineDiscoveryPlan {
    let mut groups = Vec::new();
    if !selected_relays.is_empty() {
        groups.push(DiscoveryRouteGroup {
            source: DiscoveryRouteSource::Selected,
            relays: selected_relays,
            outcome,
        });
    }
    for source in [
        DiscoveryRouteSource::Nip65,
        DiscoveryRouteSource::Provenance,
        DiscoveryRouteSource::TargetRoutes,
    ] {
        let relays = route_relays(author_routes, source);
        if !relays.is_empty() {
            groups.push(DiscoveryRouteGroup {
                source,
                relays,
                outcome,
            });
        }
    }
    plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups,
        cache_checked: true,
        follow_list_found,
        target_posts_reachable,
        offline: false,
    })
}

pub(crate) fn discovery_plan_for_relay_outcomes(
    selected_relays: Vec<String>,
    author_routes: &[AuthorRelayRoute],
    outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
    follow_list_found: bool,
) -> UserTimelineDiscoveryPlan {
    discovery_plan_for_relay_outcomes_with_target_posts(
        selected_relays,
        author_routes,
        outcomes,
        follow_list_found,
        false,
    )
}

pub(crate) fn discovery_plan_for_relay_outcomes_with_target_posts(
    selected_relays: Vec<String>,
    author_routes: &[AuthorRelayRoute],
    outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
    follow_list_found: bool,
    target_posts_reachable: bool,
) -> UserTimelineDiscoveryPlan {
    let mut groups = Vec::new();
    if !selected_relays.is_empty() {
        groups.push(DiscoveryRouteGroup {
            source: DiscoveryRouteSource::Selected,
            outcome: discovery_outcome_for_relays(
                selected_relays.iter().map(String::as_str),
                outcomes,
            ),
            relays: selected_relays,
        });
    }
    for source in [
        DiscoveryRouteSource::Nip65,
        DiscoveryRouteSource::Provenance,
        DiscoveryRouteSource::TargetRoutes,
    ] {
        let relays = route_relays(author_routes, source);
        if !relays.is_empty() {
            groups.push(DiscoveryRouteGroup {
                source,
                outcome: discovery_outcome_for_relays(relays.iter().map(String::as_str), outcomes),
                relays,
            });
        }
    }
    plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups,
        cache_checked: true,
        follow_list_found,
        target_posts_reachable,
        offline: false,
    })
}

pub(crate) fn route_label(source: RouteEvidenceSource) -> &'static str {
    match source {
        RouteEvidenceSource::Nip65 => "NIP-65",
        RouteEvidenceSource::Receipt => "provenance",
        RouteEvidenceSource::Hint => "hint",
        RouteEvidenceSource::Discovery
        | RouteEvidenceSource::MeasuredAuthorSuccess
        | RouteEvidenceSource::LocalDiscoverySuccess => "target",
    }
}

fn route_relays(routes: &[AuthorRelayRoute], source: DiscoveryRouteSource) -> Vec<String> {
    routes
        .iter()
        .filter(|route| discovery_source(route.source) == source)
        .map(|route| route.relay_url.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn discovery_source(source: RouteEvidenceSource) -> DiscoveryRouteSource {
    match source {
        RouteEvidenceSource::Nip65 => DiscoveryRouteSource::Nip65,
        RouteEvidenceSource::Receipt => DiscoveryRouteSource::Provenance,
        RouteEvidenceSource::Hint
        | RouteEvidenceSource::Discovery
        | RouteEvidenceSource::MeasuredAuthorSuccess
        | RouteEvidenceSource::LocalDiscoverySuccess => DiscoveryRouteSource::TargetRoutes,
    }
}
