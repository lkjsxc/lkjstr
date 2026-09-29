use lkjstr_app::{
    FeedLiveQueryInput, home_authors, home_live_query_input, plan_query_demand,
};
use lkjstr_relays::{DemandVisibility, initial_relay_subscription_id};

use crate::{
    home_feed_host::PAGE_SIZE, home_feed_relay_input::HomeRelayReadInput,
    home_feed_relay_read::start_read,
    home_feed_relay_model::HomeRelayReadOutput,
    relay_read_handle::RelayReadHandle,
};

pub(crate) fn start_home_relay_read(
    input: HomeRelayReadInput,
    complete: impl Fn(HomeRelayReadOutput) + 'static,
) -> Option<RelayReadHandle> {
    let authors = home_authors(&input.active_pubkey, &input.follow_pubkeys);
    let query = home_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        authors,
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: None,
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
    });
    let plan = plan_query_demand(query);
    let relays = plan.wire_request.relays;
    if relays.is_empty() {
        return None;
    }
    let sub_id = initial_relay_subscription_id("home", Some(&plan.fingerprint));
    let mut filters = plan.demand.filters;
    let scopes = relays.len().saturating_mul(filters.len()).max(1);
    let budget = crate::home_feed_host::WINDOW_MAX.saturating_sub(1) / scopes;
    let target = if input.older { crate::home_feed_host::WINDOW_MAX as u64 } else { PAGE_SIZE };
    let limit = (budget.max(1) as u64).min(target);
    for filter in &mut filters {
        filter.since = None;
        filter.until = Some(input.before.as_ref().map_or(input.now_sec, |before| before.created_at));
        filter.limit = Some(limit);
    }
    Some(start_read(input, sub_id, filters, relays, complete))
}
