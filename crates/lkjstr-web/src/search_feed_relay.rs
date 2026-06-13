use lkjstr_app::{SearchFeedView, SearchQueryInput, plan_query_demand, search_query_input};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    DemandVisibility, initial_relay_subscription_id, older_relay_subscription_id,
};

use crate::{
    relay_read_handle::RelayReadHandle,
    search_feed_host::PAGE_SIZE,
    search_feed_relay_input::{SearchRelayReadInput, SearchRelayReadPhase},
    search_feed_relay_read::start_read,
};

pub(crate) struct SearchRelayPlan {
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relays: Vec<String>,
}

pub(crate) fn start_search_relay_read(
    input: SearchRelayReadInput,
    complete: impl Fn(SearchFeedView) + 'static,
) -> Option<RelayReadHandle> {
    let plan = search_relay_plan(&input)?;
    Some(start_read(input, plan.sub_id, plan.filters, plan.relays, complete))
}

pub(crate) fn search_relay_plan(input: &SearchRelayReadInput) -> Option<SearchRelayPlan> {
    let until = relay_until(input);
    let query = search_query_input(SearchQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        query: input.query.clone(),
        since: None,
        until: Some(until),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
    })?;
    let plan = plan_query_demand(query);
    let relays = plan.wire_request.relays;
    if relays.is_empty() {
        return None;
    }
    let sub_id = subscription_id(input, &plan.fingerprint);
    let mut filters = plan.demand.filters;
    for filter in &mut filters {
        filter.until = Some(until);
        filter.limit = Some(PAGE_SIZE);
    }
    Some(SearchRelayPlan {
        sub_id,
        filters,
        relays,
    })
}

pub(crate) fn relay_until(input: &SearchRelayReadInput) -> u64 {
    match &input.phase {
        SearchRelayReadPhase::Initial => input.now_sec,
        SearchRelayReadPhase::Older { before } => before.created_at.saturating_add(1),
    }
}

fn subscription_id(input: &SearchRelayReadInput, fingerprint: &str) -> String {
    match &input.phase {
        SearchRelayReadPhase::Initial => initial_relay_subscription_id("search", Some(fingerprint)),
        SearchRelayReadPhase::Older { before } => {
            older_relay_subscription_id(
                "search",
                &format!("{}-{}", before.created_at, before.event_id),
            )
        }
    }
}
