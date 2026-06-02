#![doc = "Feed surface input record types."]

use lkjstr_relays::{AuthorRelayRoute, DemandPhase, DemandVisibility};

use crate::custom_request::CustomRequest;

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProfileLiveQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub profile_pubkey: String,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub disabled_relays: Vec<String>,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotificationsLiveQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub account_pubkey: String,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub disabled_relays: Vec<String>,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub query: String,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomRequestQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub request: CustomRequest,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ThreadRootLookupInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub event_id: String,
    pub root_author: Option<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub now_sec: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ThreadRepliesQueryInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub root_event_id: String,
    pub root_author: Option<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub phase: DemandPhase,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorContextAnchorInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub event_id: String,
    pub author_pubkey: String,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub now_sec: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorContextNearbyInput {
    pub owner: String,
    pub visibility: DemandVisibility,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub author_pubkey: String,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub phase: DemandPhase,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
}
