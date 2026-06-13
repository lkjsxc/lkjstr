#![doc = "Feed surface query input builders."]

use std::collections::BTreeMap;

use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_METADATA, KIND_REACTION, KIND_REPOST, KIND_TEXT_NOTE,
    KIND_ZAP_RECEIPT, NostrFilter,
};
use lkjstr_relays::{AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility};

use super::{FeedLiveQueryInput, NotificationsLiveQueryInput, ProfileLiveQueryInput};
use crate::{QueryDemandInput, QuerySurface};

struct LiveQueryParts {
    surface: QuerySurface,
    owner: String,
    visibility: DemandVisibility,
    selected_relays: Vec<String>,
    authors: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    disabled_relays: Vec<String>,
    filter_authors: Option<Vec<String>>,
    filter_kinds: Vec<u64>,
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
        filter_kinds: display_kinds(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

#[must_use]
pub fn user_timeline_live_query_input(input: FeedLiveQueryInput) -> QueryDemandInput {
    let authors = unique_sorted(input.authors);
    live_query_input(LiveQueryParts {
        surface: QuerySurface::UserTimeline,
        owner: input.owner,
        visibility: input.visibility,
        selected_relays: input.selected_relays,
        authors: authors.clone(),
        author_routes: input.author_routes,
        disabled_relays: input.disabled_relays,
        filter_authors: Some(authors),
        filter_kinds: display_kinds(),
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
        filter_kinds: vec![KIND_TEXT_NOTE],
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

#[must_use]
pub fn profile_live_query_input(input: ProfileLiveQueryInput) -> QueryDemandInput {
    let profile_pubkey = input.profile_pubkey;
    live_query_input(LiveQueryParts {
        surface: QuerySurface::Profile,
        owner: input.owner,
        visibility: input.visibility,
        selected_relays: input.selected_relays,
        authors: vec![profile_pubkey.clone()],
        author_routes: routes_for_author(input.author_routes, &profile_pubkey),
        disabled_relays: input.disabled_relays,
        filter_authors: Some(vec![profile_pubkey]),
        filter_kinds: display_kinds(),
        since: input.since,
        now_sec: input.now_sec,
        page_size: input.page_size,
    })
}

#[must_use]
pub fn notifications_live_query_input(input: NotificationsLiveQueryInput) -> QueryDemandInput {
    let account_pubkey = input.account_pubkey;
    QueryDemandInput {
        surface: QuerySurface::Notifications,
        owner: input.owner,
        channel: Some("notifications".to_owned()),
        visibility: input.visibility,
        phase: DemandPhase::Live,
        selected_relays: input.selected_relays,
        authors: vec![account_pubkey.clone()],
        author_routes: routes_for_author(input.author_routes, &account_pubkey),
        disabled_relays: input.disabled_relays,
        filters: vec![NostrFilter {
            kinds: Some(notification_kinds()),
            tags: notification_tags(account_pubkey),
            since: input.since,
            limit: Some(input.page_size),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        since: input.since,
        until: None,
        limit: Some(input.page_size),
        now_sec: input.now_sec,
    }
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
            kinds: Some(parts.filter_kinds),
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

fn notification_kinds() -> Vec<u64> {
    vec![
        KIND_METADATA,
        KIND_TEXT_NOTE,
        KIND_REPOST,
        KIND_REACTION,
        KIND_GENERIC_REPOST,
        KIND_ZAP_RECEIPT,
    ]
}

fn notification_tags(account_pubkey: String) -> BTreeMap<String, Vec<String>> {
    BTreeMap::from([("p".to_owned(), vec![account_pubkey])])
}

fn routes_for_author(routes: Vec<AuthorRelayRoute>, author: &str) -> Vec<AuthorRelayRoute> {
    routes
        .into_iter()
        .filter(|route| route.author == author)
        .collect()
}

fn unique_sorted(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect()
}
