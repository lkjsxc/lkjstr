#![doc = "Feed surface query input builders."]

use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrFilter};
use lkjstr_relays::{AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility};

use crate::{QueryDemandInput, QuerySurface};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLiveQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub authors: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub disabled_relays: Vec<String>,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}

struct LiveQueryParts {
    surface: QuerySurface,
    owner: String,
    visibility: DemandVisibility,
    selected_relays: Vec<String>,
    authors: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    disabled_relays: Vec<String>,
    filter_authors: Option<Vec<String>>,
    since: Option<u64>,
    now_sec: u64,
    page_size: u64,
}

#[must_use]
pub fn home_live_query_input(input: FeedLiveQueryInput) -> QueryDemandInput {
    let authors = unique_sorted(input.authors);
    live_query_input(LiveQueryParts {
        surface: QuerySurface::Home,
        owner: input.owner,
        visibility: input.visibility,
        selected_relays: input.selected_relays,
        authors: authors.clone(),
        author_routes: input.author_routes,
        disabled_relays: input.disabled_relays,
        filter_authors: Some(authors),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

#[must_use]
pub fn global_live_query_input(input: FeedLiveQueryInput) -> QueryDemandInput {
    live_query_input(LiveQueryParts {
        surface: QuerySurface::Global,
        owner: input.owner,
        visibility: input.visibility,
        selected_relays: input.selected_relays,
        authors: Vec::new(),
        author_routes: Vec::new(),
        disabled_relays: input.disabled_relays,
        filter_authors: None,
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

fn live_query_input(parts: LiveQueryParts) -> QueryDemandInput {
    QueryDemandInput {
        surface: parts.surface,
        owner: parts.owner,
        channel: Some("notes".to_owned()),
        visibility: parts.visibility,
        phase: DemandPhase::Live,
        selected_relays: parts.selected_relays,
        authors: parts.authors,
        author_routes: parts.author_routes,
        disabled_relays: parts.disabled_relays,
        filters: vec![NostrFilter {
            authors: parts.filter_authors,
            kinds: Some(display_kinds()),
            since: parts.since,
            limit: Some(parts.page_size),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        since: parts.since,
        until: None,
        limit: Some(parts.page_size),
        now_sec: parts.now_sec,
    }
}

fn display_kinds() -> Vec<u64> {
    vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]
}

fn unique_sorted(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect()
}
