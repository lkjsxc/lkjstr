#![doc = "Query demand input and output types."]

use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    AuthorRelayRoute, Demand, DemandPhase, DemandPurpose, DemandVisibility, DemandWireRequest,
    RelayRoutePlan, RoutePlanSurface,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QuerySurface {
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

impl QuerySurface {
    #[must_use]
    pub const fn as_demand_surface(self) -> lkjstr_relays::DemandSurface {
        match self {
            Self::Home => lkjstr_relays::DemandSurface::Home,
            Self::Global => lkjstr_relays::DemandSurface::Global,
            Self::Profile => lkjstr_relays::DemandSurface::Profile,
            Self::UserTimeline => lkjstr_relays::DemandSurface::UserTimeline,
            Self::Thread => lkjstr_relays::DemandSurface::Thread,
            Self::Notifications => lkjstr_relays::DemandSurface::Notifications,
            Self::Search => lkjstr_relays::DemandSurface::Search,
            Self::CustomRequest => lkjstr_relays::DemandSurface::CustomRequest,
            Self::AuthorContext => lkjstr_relays::DemandSurface::AuthorContext,
            Self::PublicChat => lkjstr_relays::DemandSurface::PublicChat,
        }
    }

    #[must_use]
    pub const fn as_route_surface(self) -> RoutePlanSurface {
        match self {
            Self::Home => RoutePlanSurface::Home,
            Self::Global => RoutePlanSurface::Global,
            Self::Profile => RoutePlanSurface::Profile,
            Self::UserTimeline => RoutePlanSurface::UserTimeline,
            Self::Thread => RoutePlanSurface::Thread,
            Self::Notifications => RoutePlanSurface::Notifications,
            Self::Search => RoutePlanSurface::Search,
            Self::CustomRequest => RoutePlanSurface::CustomRequest,
            Self::AuthorContext => RoutePlanSurface::AuthorContext,
            Self::PublicChat => RoutePlanSurface::PublicChat,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueryDemandInput {
    pub surface: QuerySurface,
    pub owner: String,
    pub channel: Option<String>,
    pub visibility: DemandVisibility,
    pub phase: DemandPhase,
    pub selected_relays: Vec<String>,
    pub authors: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub disabled_relays: Vec<String>,
    pub filters: Vec<NostrFilter>,
    pub purpose: DemandPurpose,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub limit: Option<u64>,
    pub now_sec: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueryDemandPlan {
    pub route_plan: RelayRoutePlan,
    pub demand: Demand,
    pub fingerprint: String,
    pub wire_request: DemandWireRequest,
}
