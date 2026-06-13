use lkjstr_app::thread_replies_query_input;
use lkjstr_app::{ThreadRepliesQueryInput, plan_query_demand};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    DemandPhase, DemandVisibility, initial_relay_subscription_id, live_relay_subscription_id,
    older_relay_subscription_id,
};

use crate::{
    thread_feed_host::PAGE_SIZE, thread_feed_relay_input::ThreadRelayReadInput,
    thread_feed_relay_input::ThreadRelayReadPhase,
    thread_feed_relay_exact::thread_exact_lookup_ids,
    thread_feed_relay_model::ThreadRelayReadOutput,
    thread_feed_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) struct ThreadRelayPlan {
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relays: Vec<String>,
}

pub(crate) fn start_thread_relay_read(
    input: ThreadRelayReadInput,
    complete: impl Fn(ThreadRelayReadOutput) + 'static,
) -> Option<RelayReadHandle> {
    let plan = thread_relay_plan(&input)?;
    Some(start_read(input, plan.sub_id, plan.filters, plan.relays, complete))
}

pub(crate) fn thread_relay_plan(input: &ThreadRelayReadInput) -> Option<ThreadRelayPlan> {
    let query = thread_replies_query_input(ThreadRepliesQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        root_event_id: input.root_event_id.clone(),
        focus_event_id: input.event_id.clone(),
        root_author: input.root_author.clone(),
        author_routes: input.author_routes.clone(),
        phase: demand_phase(input),
        since: Some(input.since),
        until: Some(input.until),
        now_sec: input.until,
        page_size: PAGE_SIZE,
    });
    let plan = plan_query_demand(query);
    let relays = plan.wire_request.relays;
    if relays.is_empty() {
        return None;
    }
    let sub_id = subscription_id(input, &plan.fingerprint);
    let mut filters = exact_filters(input);
    filters.extend(plan.demand.filters);
    Some(ThreadRelayPlan {
        sub_id,
        filters,
        relays,
    })
}

fn demand_phase(input: &ThreadRelayReadInput) -> DemandPhase {
    match input.phase {
        ThreadRelayReadPhase::Initial => DemandPhase::Bootstrap,
        ThreadRelayReadPhase::Live => DemandPhase::Live,
        ThreadRelayReadPhase::Older { .. } => DemandPhase::Page,
    }
}

fn subscription_id(input: &ThreadRelayReadInput, fingerprint: &str) -> String {
    match input.phase {
        ThreadRelayReadPhase::Initial => initial_relay_subscription_id("thread", Some(fingerprint)),
        ThreadRelayReadPhase::Live => live_relay_subscription_id("thread", "live"),
        ThreadRelayReadPhase::Older { cursor_created_at } => {
            older_relay_subscription_id("thread", &cursor_created_at.to_string())
        }
    }
}

fn exact_filters(input: &ThreadRelayReadInput) -> Vec<NostrFilter> {
    if !matches!(input.phase, ThreadRelayReadPhase::Initial) {
        return Vec::new();
    }
    thread_exact_lookup_ids(input)
        .into_iter()
        .map(|id| NostrFilter {
            ids: Some(vec![id]),
            limit: Some(1),
            ..NostrFilter::default()
        })
        .collect()
}
