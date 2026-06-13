use lkjstr_app::{
    FeedLiveQueryInput, QuerySurface, plan_query_demand, user_timeline_live_query_input,
};
use lkjstr_relays::{
    AuthorRelayRoute, DemandVisibility, RouteEvidenceSource, RoutePlanGroupSource,
};

#[test]
fn user_timeline_live_input_uses_own_surface_and_author_routes() -> Result<(), String> {
    let query = user_timeline_live_query_input(input(vec![pubkey("b"), pubkey("a")]));
    let plan = plan_query_demand(query.clone());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };
    let author = plan
        .route_plan
        .groups
        .iter()
        .find(|group| group.source == RoutePlanGroupSource::AuthorRoute)
        .ok_or_else(|| "wanted author route group".to_owned())?;

    assert_eq!(query.surface, QuerySurface::UserTimeline);
    assert_eq!(filter.authors, Some(vec![pubkey("a"), pubkey("b")]));
    assert_eq!(author.authors, vec![pubkey("a")]);
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
