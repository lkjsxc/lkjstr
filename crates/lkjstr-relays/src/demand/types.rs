#![doc = "Pure demand records and enums."]

use lkjstr_protocol::NostrFilter;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandPhase {
    Bootstrap,
    Live,
    Page,
}

impl DemandPhase {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Bootstrap => "bootstrap",
            Self::Live => "live",
            Self::Page => "page",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandSurface {
    Home,
    Global,
    Profile,
    UserTimeline,
    Thread,
    Notifications,
    Search,
    CustomRequest,
    AuthorContext,
    PublicChat,
}

impl DemandSurface {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Home => "home",
            Self::Global => "global",
            Self::Profile => "profile",
            Self::UserTimeline => "user-timeline",
            Self::Thread => "thread",
            Self::Notifications => "notifications",
            Self::Search => "search",
            Self::CustomRequest => "custom-request",
            Self::AuthorContext => "author-context",
            Self::PublicChat => "public-chat",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandVisibility {
    Visible,
    Hidden,
}

impl DemandVisibility {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Visible => "visible",
            Self::Hidden => "hidden",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandPriority {
    High,
    Normal,
    Low,
}

impl DemandPriority {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::High => "high",
            Self::Normal => "normal",
            Self::Low => "low",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DemandPurpose {
    Feed,
    Metadata,
    EventLookup,
    RouteDiscovery,
    Search,
}

impl DemandPurpose {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Feed => "feed",
            Self::Metadata => "metadata",
            Self::EventLookup => "event-lookup",
            Self::RouteDiscovery => "route-discovery",
            Self::Search => "search",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Demand {
    pub surface: DemandSurface,
    pub phase: DemandPhase,
    pub relays: Vec<String>,
    pub filters: Vec<NostrFilter>,
    pub purpose: DemandPurpose,
    pub owner: String,
    pub visibility: DemandVisibility,
    pub priority: Option<DemandPriority>,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub limit: Option<u64>,
    pub staleness_ms: Option<u64>,
    pub channel: Option<String>,
}

#[must_use]
pub const fn default_demand_staleness_ms() -> u64 {
    120_000
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DemandWireRequest {
    pub key: String,
    pub relays: Vec<String>,
    pub filters: Vec<NostrFilter>,
    pub purpose: DemandPurpose,
}
