#![doc = "Search and Custom Request query input builders."]

use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrFilter};
use lkjstr_relays::{DemandPhase, DemandPurpose};

use super::{CustomRequestQueryInput, SearchQueryInput};
use crate::{QueryDemandInput, QuerySurface};

#[must_use]
pub fn search_query_input(input: SearchQueryInput) -> Option<QueryDemandInput> {
    let query = input.query.trim().to_owned();
    if query.is_empty() {
        return None;
    }
    Some(QueryDemandInput {
        surface: QuerySurface::Search,
        owner: input.owner,
        channel: Some("search".to_owned()),
        visibility: input.visibility,
        phase: DemandPhase::Page,
        selected_relays: input.selected_relays,
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: input.disabled_relays,
        filters: vec![NostrFilter {
            kinds: Some(display_kinds()),
            search: Some(query),
            since: input.since,
            until: input.until,
            limit: Some(input.page_size),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Search,
        since: input.since,
        until: input.until,
        limit: Some(input.page_size),
        now_sec: input.now_sec,
    })
}

#[must_use]
pub fn custom_request_query_input(input: CustomRequestQueryInput) -> QueryDemandInput {
    let selected_relays = if input.request.relays.is_empty() {
        input.selected_relays
    } else {
        input.request.relays.clone()
    };
    QueryDemandInput {
        surface: QuerySurface::CustomRequest,
        owner: input.owner,
        channel: Some("custom-request".to_owned()),
        visibility: input.visibility,
        phase: DemandPhase::Page,
        selected_relays,
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: input.disabled_relays,
        filters: input.request.filters,
        purpose: DemandPurpose::Feed,
        since: None,
        until: None,
        limit: Some(input.page_size),
        now_sec: input.now_sec,
    }
}

fn display_kinds() -> Vec<u64> {
    vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]
}
