use lkjstr_app::{NotificationsLiveQueryInput, notifications_live_query_input, plan_query_demand};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{DemandVisibility, initial_relay_subscription_id, older_relay_subscription_id};

use crate::{
    notifications_feed_host::PAGE_SIZE,
    notifications_feed_relay_input::{NotificationsRelayReadInput, NotificationsRelayReadPhase},
    notifications_feed_relay_model::NotificationsRelayReadOutput,
    notifications_feed_relay_read::start_read,
    relay_read_handle::RelayReadHandle,
};

pub(crate) struct NotificationsRelayPlan {
    pub(crate) sub_id: String,
    pub(crate) filters: Vec<NostrFilter>,
    pub(crate) relays: Vec<String>,
}

pub(crate) fn start_notifications_relay_read(
    input: NotificationsRelayReadInput,
    complete: impl Fn(NotificationsRelayReadOutput) + 'static,
) -> Option<RelayReadHandle> {
    let plan = notifications_relay_plan(&input)?;
    Some(start_read(input, plan.sub_id, plan.filters, plan.relays, complete))
}

pub(crate) fn notifications_relay_plan(
    input: &NotificationsRelayReadInput,
) -> Option<NotificationsRelayPlan> {
    let query = notifications_live_query_input(NotificationsLiveQueryInput {
        owner: input.owner.clone(),
        visibility: DemandVisibility::Visible,
        selected_relays: input.selected_relays.clone(),
        account_pubkey: input.active_pubkey.clone(),
        author_routes: Vec::new(),
        disabled_relays: Vec::new(),
        since: Some(input.since),
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
        filter.until = Some(input.until);
        filter.limit = Some(PAGE_SIZE);
    }
    Some(NotificationsRelayPlan {
        sub_id,
        filters,
        relays,
    })
}

fn subscription_id(input: &NotificationsRelayReadInput, fingerprint: &str) -> String {
    match input.phase {
        NotificationsRelayReadPhase::Initial => {
            initial_relay_subscription_id("notifications", Some(fingerprint))
        }
        NotificationsRelayReadPhase::Older { cursor_created_at } => {
            older_relay_subscription_id("notifications", &cursor_created_at.to_string())
        }
    }
}
