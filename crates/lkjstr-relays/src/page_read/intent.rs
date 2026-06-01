#![doc = "Semantic page-read intent types."]

use lkjstr_protocol::NostrFilter;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PageReadSurface {
    Home,
    Global,
    Profile,
    Thread,
    Notifications,
    Search,
    CustomRequest,
    AuthorContext,
}

impl PageReadSurface {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Home => "home",
            Self::Global => "global",
            Self::Profile => "profile",
            Self::Thread => "thread",
            Self::Notifications => "notifications",
            Self::Search => "search",
            Self::CustomRequest => "custom-request",
            Self::AuthorContext => "author-context",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PageReadPhase {
    Bootstrap,
    Page,
}

impl PageReadPhase {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Bootstrap => "bootstrap",
            Self::Page => "page",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PageReadDirection {
    Initial,
    Older,
    Newer,
}

impl PageReadDirection {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Initial => "initial",
            Self::Older => "older",
            Self::Newer => "newer",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PageReadPurpose {
    Feed,
    Metadata,
    RouteDiscovery,
    Search,
    EventLookup,
}

impl PageReadPurpose {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Feed => "feed",
            Self::Metadata => "metadata",
            Self::RouteDiscovery => "route-discovery",
            Self::Search => "search",
            Self::EventLookup => "event-lookup",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedCursorPoint {
    pub created_at: u64,
    pub id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageReadIntent {
    pub surface: PageReadSurface,
    pub owner: String,
    pub phase: PageReadPhase,
    pub selected_relays: Vec<String>,
    pub authors: Vec<String>,
    pub page_size: u64,
    pub direction: PageReadDirection,
    pub cursor: Option<FeedCursorPoint>,
    pub before: Option<FeedCursorPoint>,
    pub after: Option<FeedCursorPoint>,
    pub purpose: PageReadPurpose,
    pub relay_filters: Vec<NostrFilter>,
    pub route_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PageReadBounds {
    pub before: Option<FeedCursorPoint>,
    pub after: Option<FeedCursorPoint>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayRouteGroup {
    pub key: String,
    pub relays: Vec<String>,
    pub authors: Vec<String>,
    pub source: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayReadRequest {
    pub key: String,
    pub relays: Vec<String>,
    pub filters: Vec<NostrFilter>,
    pub purpose: PageReadPurpose,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct ReadDedupeOptions {
    pub timeout_ms: Option<u64>,
    pub max_events: Option<u64>,
}
