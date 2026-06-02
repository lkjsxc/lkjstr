use lkjstr_app::{
    AuthorContextAnchorInput, AuthorContextNearbyInput, author_context_anchor_input,
    author_context_nearby_input, plan_query_demand,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, RouteEvidenceSource,
    RoutePlanGroupSource,
};

#[test]
fn author_context_anchor_uses_exact_lookup_with_author_routes() -> Result<(), String> {
    let query = author_context_anchor_input(anchor_input());
    let plan = plan_query_demand(query.clone());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };
    let author = plan
        .route_plan
        .groups
        .iter()
        .find(|group| group.source == RoutePlanGroupSource::AuthorRoute)
        .ok_or_else(|| "wanted author route".to_owned())?;

    assert_eq!(query.channel.as_deref(), Some("author-context-anchor"));
    assert_eq!(query.purpose, DemandPurpose::EventLookup);
    assert_eq!(filter.ids, Some(vec![event_id()]));
    assert_eq!(
        author.relays,
        vec!["wss://author-route.example/".to_owned()]
    );
    Ok(())
}

#[test]
fn author_context_nearby_targets_only_anchor_author() -> Result<(), String> {
    let query = author_context_nearby_input(nearby_input());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(query.channel.as_deref(), Some("author-context-nearby"));
    assert_eq!(query.phase, DemandPhase::Page);
    assert_eq!(filter.authors, Some(vec![pubkey("a")]));
    assert_eq!(
        filter.kinds,
        Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST])
    );
    Ok(())
}

fn anchor_input() -> AuthorContextAnchorInput {
    AuthorContextAnchorInput {
        owner: "author-context-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        event_id: event_id(),
        author_pubkey: pubkey("a"),
        author_routes: routes(),
        now_sec: now_sec(),
    }
}

fn nearby_input() -> AuthorContextNearbyInput {
    AuthorContextNearbyInput {
        owner: "author-context-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_pubkey: pubkey("a"),
        author_routes: routes(),
        phase: DemandPhase::Page,
        since: Some(10),
        until: Some(20),
        now_sec: now_sec(),
        page_size: 30,
    }
}

fn routes() -> Vec<AuthorRelayRoute> {
    vec![
        route(pubkey("a"), "https://author-route.example"),
        route(pubkey("b"), "https://wrong-route.example"),
    ]
}

fn route(author: String, relay_url: &str) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author,
        relay_url: relay_url.to_owned(),
        source: RouteEvidenceSource::Nip65,
        score: 10,
    }
}

fn event_id() -> String {
    "f".repeat(64)
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}
