use lkjstr_app::{QueryDemandInput, QuerySurface, plan_query_demand};
use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, RouteEvidenceSource,
    RoutePlanDiagnosticKind, RoutePlanGroupSource,
};

#[test]
fn home_query_plan_combines_author_routes_and_selected_fallback() -> Result<(), String> {
    let plan = plan_query_demand(input("tab-a", QuerySurface::Home));
    let author = plan
        .route_plan
        .groups
        .iter()
        .find(|group| group.source == RoutePlanGroupSource::AuthorRoute)
        .ok_or_else(|| "wanted author group".to_owned())?;

    assert_eq!(author.relays, vec!["wss://route.example/".to_owned()]);
    assert!(
        plan.demand
            .relays
            .contains(&"wss://route.example/".to_owned())
    );
    assert!(
        plan.demand
            .relays
            .contains(&"wss://selected.example/".to_owned())
    );
    assert_eq!(plan.wire_request.purpose, DemandPurpose::Feed);
    Ok(())
}

#[test]
fn query_fingerprint_ignores_owner_identity() {
    let left = plan_query_demand(input("tab-a", QuerySurface::Home));
    let right = plan_query_demand(input("tab-b", QuerySurface::Home));

    assert_eq!(left.fingerprint, right.fingerprint);
    assert_ne!(left.demand.owner, right.demand.owner);
}

#[test]
fn global_query_uses_selected_relays_without_author_expansion() -> Result<(), String> {
    let plan = plan_query_demand(input("tab-a", QuerySurface::Global));
    let Some(group) = plan.route_plan.groups.first() else {
        return Err("wanted selected group".to_owned());
    };

    assert_eq!(plan.route_plan.groups.len(), 1);
    assert_eq!(group.source, RoutePlanGroupSource::SelectedFallback);
    assert!(
        plan.route_plan
            .diagnostics
            .iter()
            .any(|diagnostic| { diagnostic.kind == RoutePlanDiagnosticKind::SurfaceRoutesIgnored })
    );
    Ok(())
}

#[test]
fn disabled_relay_is_excluded_before_demand_creation() {
    let mut input = input("tab-a", QuerySurface::Home);
    input.disabled_relays = vec!["wss://route.example".to_owned()];
    let plan = plan_query_demand(input);

    assert!(
        !plan
            .demand
            .relays
            .contains(&"wss://route.example/".to_owned())
    );
    assert!(
        plan.route_plan.diagnostics.iter().any(|diagnostic| {
            diagnostic.kind == RoutePlanDiagnosticKind::DisabledRelayExcluded
        })
    );
}

fn input(owner: &str, surface: QuerySurface) -> QueryDemandInput {
    QueryDemandInput {
        surface,
        owner: owner.to_owned(),
        channel: Some("notes".to_owned()),
        visibility: DemandVisibility::Visible,
        phase: DemandPhase::Live,
        selected_relays: vec!["https://selected.example".to_owned()],
        authors: vec![pubkey("a")],
        author_routes: vec![route(pubkey("a"), "https://route.example")],
        disabled_relays: Vec::new(),
        filters: vec![NostrFilter {
            authors: Some(vec![pubkey("a")]),
            kinds: Some(vec![1]),
            limit: Some(30),
            ..NostrFilter::default()
        }],
        purpose: DemandPurpose::Feed,
        since: Some(now_sec()),
        until: None,
        limit: None,
        now_sec: now_sec(),
    }
}

fn route(author: String, relay_url: &str) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author,
        relay_url: relay_url.to_owned(),
        source: RouteEvidenceSource::Nip65,
        score: 10,
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}
