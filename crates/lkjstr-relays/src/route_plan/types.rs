#![doc = "Pure route-plan types."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RoutePlanSurface {
    Home,
    Global,
    Profile,
    UserTimeline,
    Thread,
    Notifications,
    Search,
    CustomRequest,
    AuthorContext,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RouteEvidenceSource {
    Nip65,
    Receipt,
    Hint,
    Discovery,
    MeasuredAuthorSuccess,
    LocalDiscoverySuccess,
}

impl RouteEvidenceSource {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::Nip65 => "nip65",
            Self::Receipt => "receipt",
            Self::Hint => "hint",
            Self::Discovery => "discovery",
            Self::MeasuredAuthorSuccess => "measured-author-success",
            Self::LocalDiscoverySuccess => "local-discovery-success",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RoutePlanGroupSource {
    SelectedFallback,
    AuthorRoute,
}

impl RoutePlanGroupSource {
    #[must_use]
    pub const fn as_key(self) -> &'static str {
        match self {
            Self::SelectedFallback => "selected-fallback",
            Self::AuthorRoute => "author-route",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorRelayRoute {
    pub author: String,
    pub relay_url: String,
    pub source: RouteEvidenceSource,
    pub score: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutePlanInput {
    pub surface: RoutePlanSurface,
    pub selected_relays: Vec<String>,
    pub authors: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub disabled_relays: Vec<String>,
    pub max_route_relays_per_author: usize,
    pub max_targeted_groups: usize,
    pub max_authors_per_group: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutePlanGroup {
    pub key: String,
    pub relays: Vec<String>,
    pub authors: Vec<String>,
    pub source: RoutePlanGroupSource,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RoutePlanDiagnosticKind {
    DisabledRelayExcluded,
    InvalidRelayIgnored,
    TargetGroupLimitReached,
    SurfaceRoutesIgnored,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoutePlanDiagnostic {
    pub kind: RoutePlanDiagnosticKind,
    pub relay_url: Option<String>,
    pub author: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayRoutePlan {
    pub groups: Vec<RoutePlanGroup>,
    pub diagnostics: Vec<RoutePlanDiagnostic>,
}

#[must_use]
pub const fn default_max_route_relays_per_author() -> usize {
    4
}

#[must_use]
pub const fn default_max_targeted_route_groups() -> usize {
    12
}

#[must_use]
pub const fn default_max_authors_per_route_group() -> usize {
    50
}
