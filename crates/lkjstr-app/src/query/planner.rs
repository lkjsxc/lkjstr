#![doc = "Pure query-demand planner."]

use std::collections::BTreeSet;

use lkjstr_relays::{
    Demand, RoutePlanInput, default_demand_staleness_ms, default_max_authors_per_route_group,
    default_max_route_relays_per_author, default_max_targeted_route_groups, demand_to_wire_request,
    plan_relay_routes, wire_equivalent_fingerprint,
};

use super::{QueryDemandInput, QueryDemandPlan};

#[must_use]
pub fn plan_query_demand(input: QueryDemandInput) -> QueryDemandPlan {
    let route_plan = plan_relay_routes(RoutePlanInput {
        surface: input.surface.as_route_surface(),
        selected_relays: input.selected_relays.clone(),
        authors: input.authors.clone(),
        author_routes: input.author_routes.clone(),
        disabled_relays: input.disabled_relays.clone(),
        max_route_relays_per_author: default_max_route_relays_per_author(),
        max_targeted_groups: default_max_targeted_route_groups(),
        max_authors_per_group: default_max_authors_per_route_group(),
    });
    let demand = Demand {
        surface: input.surface.as_demand_surface(),
        phase: input.phase,
        relays: flattened_relays(&route_plan),
        filters: input.filters,
        purpose: input.purpose,
        owner: input.owner,
        visibility: input.visibility,
        priority: None,
        since: input.since,
        until: input.until,
        limit: input.limit,
        staleness_ms: Some(default_demand_staleness_ms()),
        channel: input.channel,
    };
    let fingerprint = wire_equivalent_fingerprint(&demand, input.now_sec);
    let wire_request = demand_to_wire_request(&demand, input.now_sec);
    QueryDemandPlan {
        route_plan,
        demand,
        fingerprint,
        wire_request,
    }
}

fn flattened_relays(route_plan: &lkjstr_relays::RelayRoutePlan) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut relays = Vec::new();
    for group in &route_plan.groups {
        for relay in &group.relays {
            if seen.insert(relay.clone()) {
                relays.push(relay.clone());
            }
        }
    }
    relays
}
