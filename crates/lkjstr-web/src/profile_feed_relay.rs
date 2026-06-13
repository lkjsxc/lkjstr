use lkjstr_app::{
    ProfileFeedView, ProfileLiveQueryInput, plan_query_demand, profile_live_query_input,
};
use lkjstr_relays::{DemandVisibility, initial_relay_subscription_id};

use crate::{
    profile_feed_host::PAGE_SIZE, profile_feed_relay_input::ProfileRelayReadInput,
    profile_feed_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) fn start_profile_relay_read(
    input: ProfileRelayReadInput,
    complete: impl Fn(ProfileFeedView) + 'static,
) -> Option<RelayReadHandle> {
    let query = profile_live_query_input(ProfileLiveQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        profile_pubkey: input.profile_pubkey.clone(),
        author_routes: input.author_routes.clone(),
        disabled_relays: Vec::new(),
        since: Some(input.since),
        now_sec: input.until,
        page_size: PAGE_SIZE,
    });
    let plan = plan_query_demand(query);
    let relays = plan.wire_request.relays;
    if relays.is_empty() {
        return None;
    }
    let sub_id = initial_relay_subscription_id("profile", Some(&plan.fingerprint));
    let mut filters = plan.demand.filters;
    for filter in &mut filters {
        filter.until = Some(input.until);
        filter.limit = Some(PAGE_SIZE);
    }
    Some(start_read(input, sub_id, filters, relays, complete))
}
