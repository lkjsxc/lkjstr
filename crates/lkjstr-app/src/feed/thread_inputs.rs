#![doc = "Thread root and reply query input builders."]

use std::collections::BTreeMap;

use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrFilter};
use lkjstr_relays::{AuthorRelayRoute, DemandPhase, DemandPurpose};

use super::{ThreadRepliesQueryInput, ThreadRootLookupInput};
use crate::{QueryDemandInput, QuerySurface};

#[must_use]
pub fn thread_root_lookup_input(input: ThreadRootLookupInput) -> QueryDemandInput {
    let (authors, author_routes) = author_route_parts(input.root_author, input.author_routes);
    QueryDemandInput {
        surface: QuerySurface::Thread,
        owner: input.owner,
        channel: Some("thread-root".to_owned()),
        visibility: input.visibility,
        phase: DemandPhase::Bootstrap,
        selected_relays: input.selected_relays,
        authors,
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
pub fn thread_replies_query_input(input: ThreadRepliesQueryInput) -> QueryDemandInput {
    let (authors, author_routes) = author_route_parts(input.root_author, input.author_routes);
    QueryDemandInput {
        surface: QuerySurface::Thread,
        owner: input.owner,
        channel: Some("thread-replies".to_owned()),
        visibility: input.visibility,
        phase: input.phase,
        selected_relays: input.selected_relays,
        authors,
        author_routes,
        disabled_relays: input.disabled_relays,
        filters: vec![NostrFilter {
            kinds: Some(display_kinds()),
            tags: BTreeMap::from([(
                "e".to_owned(),
                reply_targets(input.root_event_id, input.focus_event_id),
            )]),
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

fn reply_targets(root: String, focus: String) -> Vec<String> {
    if root == focus {
        return vec![root];
    }
    vec![root, focus]
}

fn author_route_parts(
    author: Option<String>,
    routes: Vec<AuthorRelayRoute>,
) -> (Vec<String>, Vec<AuthorRelayRoute>) {
    match author {
        Some(author) => {
            let routes = routes
                .into_iter()
                .filter(|route| route.author == author)
                .collect();
            (vec![author], routes)
        }
        None => (Vec::new(), Vec::new()),
    }
}

fn display_kinds() -> Vec<u64> {
    vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST]
}
