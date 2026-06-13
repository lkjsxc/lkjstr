use lkjstr_app::{FeedLiveQueryInput, global_live_query_input, plan_query_demand};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    DemandVisibility, initial_relay_subscription_id, older_relay_subscription_id,
};

use crate::{
    global_feed_host::PAGE_SIZE,
    global_feed_relay_input::{GlobalRelayReadInput, GlobalRelayReadPhase},
    global_feed_relay_model::GlobalRelayReadOutput,
    global_feed_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) struct GlobalRelayPlan {
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relays: Vec<String>,
}

pub(crate) fn start_global_relay_read(
    input: GlobalRelayReadInput,
    complete: impl Fn(GlobalRelayReadOutput) + 'static,
) -> Option<RelayReadHandle> {
    let plan = global_relay_plan(&input)?;
    Some(start_read(input, plan.sub_id, plan.filters, plan.relays, complete))
}

pub(crate) fn global_relay_plan(input: &GlobalRelayReadInput) -> Option<GlobalRelayPlan> {
    let query = global_live_query_input(FeedLiveQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: relay_since(input),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
    });
    let plan = plan_query_demand(query);
    let relays = plan.wire_request.relays;
    if relays.is_empty() {
        return None;
    }
    let sub_id = subscription_id(input, &plan.fingerprint);
    let mut filters = plan.demand.filters;
    for filter in &mut filters {
        filter.until = Some(relay_until(input));
        filter.limit = Some(PAGE_SIZE);
    }
    Some(GlobalRelayPlan {
        sub_id,
        filters,
        relays,
    })
}

fn relay_since(input: &GlobalRelayReadInput) -> Option<u64> {
    match &input.phase {
        GlobalRelayReadPhase::Initial => Some(input.now_sec.saturating_sub(30)),
        GlobalRelayReadPhase::Older { .. } => None,
    }
}

fn relay_until(input: &GlobalRelayReadInput) -> u64 {
    match &input.phase {
        GlobalRelayReadPhase::Initial => input.now_sec,
        GlobalRelayReadPhase::Older { before } => before.created_at.saturating_add(1),
    }
}

fn subscription_id(input: &GlobalRelayReadInput, fingerprint: &str) -> String {
    match &input.phase {
        GlobalRelayReadPhase::Initial => initial_relay_subscription_id("global", Some(fingerprint)),
        GlobalRelayReadPhase::Older { before } => older_relay_subscription_id(
            "global",
            &format!("{}-{}", before.created_at, before.event_id),
        ),
    }
}
