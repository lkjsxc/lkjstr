use lkjstr_app::{
    CustomRequestRunPlan, CustomRequestRunStatus, FeedWindowState, empty_feed_window,
    plan_query_demand,
};
use lkjstr_protocol::{NostrEvent, NostrFilter, matches_any_filter};
use lkjstr_relays::initial_relay_subscription_id;

const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct CustomRequestRelayReadInput {
    pub(crate) owner: String,
    pub(crate) plan: CustomRequestRunPlan,
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relays: Vec<String>,
    pub(crate) cache_window: FeedWindowState,
}

pub(crate) fn custom_request_relay_input(
    owner: String,
    plan: CustomRequestRunPlan,
) -> Option<CustomRequestRelayReadInput> {
    if plan.status != CustomRequestRunStatus::Ready {
        return None;
    }
    let demand = plan.demand.clone()?;
    let query = plan_query_demand(demand);
    let filters = query.wire_request.filters;
    let relays = query.wire_request.relays;
    if relays.is_empty() || filters.is_empty() {
        return None;
    }
    Some(CustomRequestRelayReadInput {
        owner,
        plan,
        sub_id: initial_relay_subscription_id("custom-request", Some(&query.fingerprint)),
        filters,
        relays,
        cache_window: empty_feed_window(1, WINDOW_MAX),
    })
}

pub(crate) fn custom_request_event_matches_read(
    input: &CustomRequestRelayReadInput,
    event: &NostrEvent,
) -> bool {
    matches_any_filter(event, &input.filters)
}
