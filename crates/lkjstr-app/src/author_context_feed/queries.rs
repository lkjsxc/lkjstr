use lkjstr_relays::DemandPhase;

use crate::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, FeedStateRow, author_context_anchor_input,
    author_context_nearby_input, diagnostic_state_row,
};

use super::AuthorContextFeedViewInput;

pub(super) fn anchor_query(
    input: &AuthorContextFeedViewInput,
    event_id: &str,
    author_pubkey: &str,
) -> crate::QueryDemandInput {
    author_context_anchor_input(AuthorContextAnchorInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: input.disabled_relays.clone(),
        event_id: event_id.to_owned(),
        author_pubkey: author_pubkey.to_owned(),
        author_routes: input.author_routes.clone(),
        now_sec: input.now_sec,
    })
}

pub(super) fn nearby_query(
    input: &AuthorContextFeedViewInput,
    created_at: u64,
    author_pubkey: &str,
) -> crate::QueryDemandInput {
    author_context_nearby_input(AuthorContextNearbyInput {
        owner: input.owner.clone(),
        visibility: input.visibility,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: input.disabled_relays.clone(),
        author_pubkey: author_pubkey.to_owned(),
        author_routes: input.author_routes.clone(),
        phase: DemandPhase::Live,
        since: None,
        until: Some(created_at),
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

pub(super) fn diagnostic_rows(input: &AuthorContextFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}
