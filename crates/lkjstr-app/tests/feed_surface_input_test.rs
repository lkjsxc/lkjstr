use lkjstr_app::{
    FeedLiveQueryInput, QuerySurface, global_live_query_input, home_live_query_input,
    plan_query_demand,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, RouteEvidenceSource,
    RoutePlanGroupSource,
};

#[test]
fn home_live_input_uses_display_kinds_and_known_authors() -> Result<(), String> {
    let query = home_live_query_input(input(vec![pubkey("b"), pubkey("a"), pubkey("a")]));
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(query.surface, QuerySurface::Home);
    assert_eq!(query.phase, DemandPhase::Live);
    assert_eq!(query.purpose, DemandPurpose::Feed);
    assert_eq!(query.authors, vec![pubkey("a"), pubkey("b")]);
    assert_eq!(filter.authors, Some(vec![pubkey("a"), pubkey("b")]));
    assert_eq!(
        filter.kinds,
        Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST])
    );
    Ok(())
}

#[test]
fn home_live_input_does_not_create_self_only_fallback() -> Result<(), String> {
    let query = home_live_query_input(input(Vec::new()));
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert!(query.authors.is_empty());
    assert_eq!(filter.authors, Some(Vec::new()));
    Ok(())
}

#[test]
fn global_live_input_uses_selected_relays_without_authors_or_routes() -> Result<(), String> {
    let query = global_live_query_input(input(vec![pubkey("a")]));
    let plan = plan_query_demand(query.clone());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };
    let [group] = plan.route_plan.groups.as_slice() else {
        return Err("wanted selected route group".to_owned());
    };

    assert_eq!(query.surface, QuerySurface::Global);
    assert!(query.authors.is_empty());
    assert!(query.author_routes.is_empty());
    assert_eq!(filter.authors, None);
    assert_eq!(group.source, RoutePlanGroupSource::SelectedFallback);
    assert_eq!(group.relays, vec!["wss://selected.example/".to_owned()]);
    Ok(())
}

fn input(authors: Vec<String>) -> FeedLiveQueryInput {
    FeedLiveQueryInput {
        owner: "tab-a".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        authors,
        author_routes: vec![AuthorRelayRoute {
            author: pubkey("a"),
            relay_url: "https://route.example".to_owned(),
            source: RouteEvidenceSource::Nip65,
            score: 10,
        }],
        disabled_relays: Vec::new(),
        since: Some(now_sec()),
        now_sec: now_sec(),
        page_size: 30,
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}
