use lkjstr_app::{
    FeedLiveQueryInput, HomeFeedView, home_authors, home_live_query_input, plan_query_demand,
};
use lkjstr_relays::{DemandVisibility, initial_relay_subscription_id};

use crate::{
    home_feed_host::PAGE_SIZE, home_feed_relay_input::HomeRelayReadInput,
    home_feed_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) fn start_home_relay_read(
    input: HomeRelayReadInput,
    complete: impl Fn(HomeFeedView) + 'static,
) -> Option<RelayReadHandle> {
    let authors = home_authors(&input.active_pubkey, &input.follow_pubkeys);
    let query = home_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        authors,
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: Some(input.now_sec.saturating_sub(30)),
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
    for filter in &mut filters {
        filter.until = Some(input.now_sec);
        filter.limit = Some(PAGE_SIZE);
    }
    Some(start_read(input, sub_id, filters, relays, complete))
}
