#![doc = "Pure relay route planning."]

mod plan;
mod plan_tail;
mod types;

pub use plan::plan_relay_routes;
pub use types::{
    AuthorRelayRoute, RelayRoutePlan, RouteEvidenceSource, RoutePlanDiagnostic,
    RoutePlanDiagnosticKind, RoutePlanGroup, RoutePlanGroupSource, RoutePlanInput,
    RoutePlanSurface, default_max_authors_per_route_group, default_max_route_relays_per_author,
    default_max_targeted_route_groups,
};
