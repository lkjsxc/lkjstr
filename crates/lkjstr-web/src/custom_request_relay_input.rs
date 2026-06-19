use std::collections::BTreeMap;

use lkjstr_app::{
    CustomRequestRunPlan, CustomRequestRunStatus, FeedWindowState, RowGeometryModel,
    empty_feed_window, plan_query_demand,
};
use lkjstr_protocol::{NostrEvent, NostrFilter, matches_any_filter};
use lkjstr_relays::initial_relay_subscription_id;

const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct CustomRequestRelayReadInput {
    pub(crate) owner: String,
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
    pub(crate) plan: CustomRequestRunPlan,
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relay_filters: BTreeMap<String, Vec<NostrFilter>>,
    pub(crate) relays: Vec<String>,
    pub(crate) cache_window: FeedWindowState,
    pub(crate) geometry_models: Vec<RowGeometryModel>,
}

pub(crate) struct CustomRequestRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) db_name: &'a str,
    pub(crate) worker_url: &'a str,
    pub(crate) plan: CustomRequestRunPlan,
    pub(crate) geometry_models: &'a [RowGeometryModel],
}

pub(crate) fn custom_request_relay_input(
    seed: CustomRequestRelayInputSeed<'_>,
) -> Option<CustomRequestRelayReadInput> {
    if seed.plan.status != CustomRequestRunStatus::Ready {
        return None;
    }
    let demand = seed.plan.demand.clone()?;
    let query = plan_query_demand(demand);
    let filters = query.wire_request.filters;
    let relays = query.wire_request.relays;
    if relays.is_empty() || filters.is_empty() {
        return None;
    }
    Some(CustomRequestRelayReadInput {
        owner: seed.owner.to_owned(),
        db_name: seed.db_name.to_owned(),
        worker_url: seed.worker_url.to_owned(),
        relay_filters: relay_filters(&seed.plan),
        plan: seed.plan,
        sub_id: initial_relay_subscription_id("custom-request", Some(&query.fingerprint)),
        filters,
        relays,
        cache_window: empty_feed_window(1, WINDOW_MAX),
        geometry_models: seed.geometry_models.to_vec(),
    })
}

impl CustomRequestRelayReadInput {
    pub(crate) fn filters_for_relay(&self, relay: &str) -> Vec<NostrFilter> {
        self.relay_filters
            .get(relay)
            .cloned()
            .unwrap_or_else(|| self.filters.clone())
    }
}

pub(crate) fn custom_request_event_matches_read(
    input: &CustomRequestRelayReadInput,
    event: &NostrEvent,
) -> bool {
    matches_any_filter(event, &input.filters)
}

fn relay_filters(plan: &CustomRequestRunPlan) -> BTreeMap<String, Vec<NostrFilter>> {
    plan.request
        .as_ref()
        .map(|request| {
            request
                .relay_filters
                .iter()
                .map(|item| (item.relay_url.clone(), item.filters.clone()))
                .collect()
        })
        .unwrap_or_default()
}
