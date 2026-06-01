use lkjstr_relays::{
    AuthorRelayRoute, RouteEvidenceSource, RoutePlanDiagnosticKind, RoutePlanGroupSource,
    RoutePlanInput, RoutePlanSurface, plan_relay_routes,
};

#[test]
fn home_plan_keeps_selected_fallback_with_targeted_author_routes() -> Result<(), String> {
    let plan = plan_relay_routes(input(RoutePlanSurface::Home));
    let author = find_group(&plan.groups, RoutePlanGroupSource::AuthorRoute)?;
    let fallback = find_group(&plan.groups, RoutePlanGroupSource::SelectedFallback)?;

    assert_eq!(author.key, format!("author:{}", pubkey("a")));
    assert_eq!(author.relays, vec!["wss://route.example/".to_owned()]);
    assert_eq!(
        fallback.relays,
        vec![
            "wss://selected-a.example/".to_owned(),
            "wss://selected-b.example/".to_owned()
        ]
    );
    Ok(())
}

#[test]
fn global_plan_ignores_author_routes() -> Result<(), String> {
    let plan = plan_relay_routes(input(RoutePlanSurface::Global));
    let fallback = find_group(&plan.groups, RoutePlanGroupSource::SelectedFallback)?;

    assert_eq!(plan.groups.len(), 1);
    assert_eq!(fallback.source, RoutePlanGroupSource::SelectedFallback);
    assert!(
        plan.diagnostics
            .iter()
            .any(|diagnostic| { diagnostic.kind == RoutePlanDiagnosticKind::SurfaceRoutesIgnored })
    );
    Ok(())
}

#[test]
fn disabled_relays_are_excluded_from_all_groups() -> Result<(), String> {
    let mut input = input(RoutePlanSurface::Home);
    input.disabled_relays = vec![
        "wss://route.example".to_owned(),
        "wss://selected-b.example".to_owned(),
    ];
    let plan = plan_relay_routes(input);
    let fallback = find_group(&plan.groups, RoutePlanGroupSource::SelectedFallback)?;

    assert_eq!(plan.groups.len(), 1);
    assert_eq!(
        fallback.relays,
        vec!["wss://selected-a.example/".to_owned()]
    );
    assert_eq!(
        plan.diagnostics
            .iter()
            .filter(|item| item.kind == RoutePlanDiagnosticKind::DisabledRelayExcluded)
            .count(),
        2
    );
    Ok(())
}

#[test]
fn scores_order_without_excluding_low_score_relays() -> Result<(), String> {
    let mut input = input(RoutePlanSurface::Profile);
    input.max_route_relays_per_author = 4;
    input.author_routes = vec![
        route(pubkey("a"), "wss://slow.example", -50),
        route(pubkey("a"), "wss://fast.example", 90),
    ];
    let plan = plan_relay_routes(input);
    let author = find_group(&plan.groups, RoutePlanGroupSource::AuthorRoute)?;

    assert_eq!(
        author.relays,
        vec![
            "wss://fast.example/".to_owned(),
            "wss://slow.example/".to_owned()
        ]
    );
    Ok(())
}

#[test]
fn target_group_cap_limits_author_groups() {
    let mut input = input(RoutePlanSurface::Home);
    input.authors = vec![pubkey("a"), pubkey("b")];
    input.author_routes = vec![
        route(pubkey("a"), "wss://a.example", 10),
        route(pubkey("b"), "wss://b.example", 10),
    ];
    input.max_targeted_groups = 1;
    let plan = plan_relay_routes(input);

    assert_eq!(
        plan.groups
            .iter()
            .filter(|group| group.source == RoutePlanGroupSource::AuthorRoute)
            .count(),
        1
    );
}

fn input(surface: RoutePlanSurface) -> RoutePlanInput {
    RoutePlanInput {
        surface,
        selected_relays: vec![
            "wss://selected-b.example".to_owned(),
            "https://selected-a.example".to_owned(),
        ],
        authors: vec![pubkey("a")],
        author_routes: vec![route(pubkey("a"), "https://route.example", 10)],
        disabled_relays: Vec::new(),
        max_route_relays_per_author: 4,
        max_targeted_groups: 12,
        max_authors_per_group: 50,
    }
}

fn find_group(
    groups: &[lkjstr_relays::RoutePlanGroup],
    source: RoutePlanGroupSource,
) -> Result<&lkjstr_relays::RoutePlanGroup, String> {
    groups
        .iter()
        .find(|group| group.source == source)
        .ok_or_else(|| "wanted route group".to_owned())
}

fn route(author: String, relay_url: &str, score: i64) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author,
        relay_url: relay_url.to_owned(),
        source: RouteEvidenceSource::Nip65,
        score,
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
