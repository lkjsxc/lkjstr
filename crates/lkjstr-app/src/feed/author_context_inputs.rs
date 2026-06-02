#![doc = "Author Context anchor and nearby-author builders."]

use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrFilter};
use lkjstr_relays::{AuthorRelayRoute, DemandPhase, DemandPurpose};

use super::{AuthorContextAnchorInput, AuthorContextNearbyInput};
use crate::{QueryDemandInput, QuerySurface};

#[must_use]
pub fn author_context_anchor_input(input: AuthorContextAnchorInput) -> QueryDemandInput {
    let author_routes = routes_for_author(input.author_routes, &input.author_pubkey);
    QueryDemandInput {
        surface: QuerySurface::AuthorContext,
        owner: input.owner,
        channel: Some("author-context-anchor".to_owned()),
        visibility: input.visibility,
        phase: DemandPhase::Bootstrap,
        selected_relays: input.selected_relays,
        authors: vec![input.author_pubkey],
        author_routes,
        disabled_relays: input.disabled_relays,
        filters: vec![NostrFilter {
            ids: Some(vec![input.event_id]),
            limit: Some(1),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::EventLookup,
        since: None,
        until: None,
        limit: Some(1),
        now_sec: input.now_sec,
    }
}

#[must_use]
pub fn author_context_nearby_input(input: AuthorContextNearbyInput) -> QueryDemandInput {
    let author_routes = routes_for_author(input.author_routes, &input.author_pubkey);
    QueryDemandInput {
        surface: QuerySurface::AuthorContext,
        owner: input.owner,
        channel: Some("author-context-nearby".to_owned()),
        visibility: input.visibility,
        phase: input.phase,
        selected_relays: input.selected_relays,
        authors: vec![input.author_pubkey.clone()],
        author_routes,
        disabled_relays: input.disabled_relays,
        filters: vec![NostrFilter {
            authors: Some(vec![input.author_pubkey]),
            kinds: Some(display_kinds()),
            since: input.since,
            until: input.until,
            limit: Some(input.page_size),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        since: input.since,
        until: input.until,
        limit: Some(input.page_size),
        now_sec: input.now_sec,
    }
}

fn routes_for_author(routes: Vec<AuthorRelayRoute>, author: &str) -> Vec<AuthorRelayRoute> {
    routes
        .into_iter()
        .filter(|route| route.author == author)
        .collect()
}

fn display_kinds() -> Vec<u64> {
    vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]
}
