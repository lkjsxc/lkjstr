use lkjstr_app::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, author_context_anchor_input,
    author_context_nearby_input, plan_query_demand,
};
use lkjstr_relays::{DemandPhase, DemandVisibility, initial_relay_subscription_id};

use crate::{
    author_context_host::PAGE_SIZE,
    author_context_relay_input::{
        AuthorContextRelayReadInput, NEARBY_SECONDS, author_context_relay_filters,
    },
    author_context_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) struct AuthorContextRelayPlan {
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<lkjstr_protocol::NostrFilter>,
    pub(crate) relays: Vec<String>,
}

pub(crate) fn start_author_context_relay_read(
    input: AuthorContextRelayReadInput,
    complete: impl Fn(lkjstr_app::AuthorContextFeedView) + 'static,
) -> Option<RelayReadHandle> {
    let plan = author_context_relay_plan(&input)?;
    Some(start_read(
        input,
        plan.sub_id,
        plan.filters,
        plan.relays,
        complete,
    ))
}

pub(crate) fn author_context_relay_plan(
    input: &AuthorContextRelayReadInput,
) -> Option<AuthorContextRelayPlan> {
    let relays = relay_plan_relays(input);
    if relays.is_empty() {
        return None;
    }
    let sub_id = initial_relay_subscription_id("author-context", Some(&input.event_id));
    Some(AuthorContextRelayPlan {
        sub_id,
        filters: author_context_relay_filters(input),
        relays,
    })
}

fn relay_plan_relays(input: &AuthorContextRelayReadInput) -> Vec<String> {
    if input.anchor_created_at.is_none() {
        return anchor_plan_relays(input);
    }
    nearby_plan_relays(input)
}

fn anchor_plan_relays(input: &AuthorContextRelayReadInput) -> Vec<String> {
    let demand = author_context_anchor_input(AuthorContextAnchorInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        event_id: input.event_id.clone(),
        author_pubkey: input.author_pubkey.clone(),
        author_routes: input.author_routes.clone(),
        now_sec: input.now_sec,
    });
    plan_query_demand(demand).wire_request.relays
}

fn nearby_plan_relays(input: &AuthorContextRelayReadInput) -> Vec<String> {
    let anchor_created_at = input.anchor_created_at.unwrap_or(input.now_sec);
    let demand = author_context_nearby_input(AuthorContextNearbyInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        author_pubkey: input.author_pubkey.clone(),
        author_routes: input.author_routes.clone(),
        phase: DemandPhase::Bootstrap,
        since: Some(anchor_created_at.saturating_sub(NEARBY_SECONDS)),
        until: Some(anchor_created_at.saturating_add(NEARBY_SECONDS)),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
    });
    plan_query_demand(demand).wire_request.relays
}
