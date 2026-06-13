use lkjstr_app::{
    FeedLiveQueryInput, NotificationsLiveQueryInput, ProfileLiveQueryInput, QuerySurface,
    global_live_query_input, home_live_query_input, notifications_live_query_input,
    plan_query_demand, profile_live_query_input,
};
use lkjstr_protocol::{
    KIND_GENERIC_REPOST, KIND_METADATA, KIND_REACTION, KIND_REPOST, KIND_TEXT_NOTE,
    KIND_ZAP_RECEIPT,
};
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
    assert_eq!(filter.kinds, Some(vec![KIND_TEXT_NOTE]));
    assert_eq!(group.source, RoutePlanGroupSource::SelectedFallback);
    assert_eq!(group.relays, vec!["wss://selected.example/".to_owned()]);
    Ok(())
}

#[test]
fn profile_live_input_targets_profile_author_and_routes() -> Result<(), String> {
    let profile = pubkey("b");
    let query = profile_live_query_input(profile_input(profile.clone()));
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

    assert_eq!(query.surface, QuerySurface::Profile);
    assert_eq!(query.authors, vec![profile.clone()]);
    assert_eq!(filter.authors, Some(vec![profile.clone()]));
    assert_eq!(author.authors, vec![profile]);
    assert_eq!(
        author.relays,
        vec!["wss://profile-route.example/".to_owned()]
    );
    Ok(())
}

#[test]
fn notifications_live_input_targets_p_tag_without_author_filter() -> Result<(), String> {
    let account = pubkey("c");
    let query = notifications_live_query_input(notifications_input(account.clone()));
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

    assert_eq!(query.surface, QuerySurface::Notifications);
    assert_eq!(query.channel.as_deref(), Some("notifications"));
    assert_eq!(filter.authors, None);
    assert_eq!(filter.tags.get("p"), Some(&vec![account.clone()]));
    assert_eq!(
        filter.kinds,
        Some(vec![
            KIND_METADATA,
            KIND_TEXT_NOTE,
            KIND_REPOST,
            KIND_REACTION,
            KIND_GENERIC_REPOST,
            KIND_ZAP_RECEIPT
        ])
    );
    assert_eq!(author.authors, vec![account]);
    assert_eq!(
        author.relays,
        vec!["wss://notify-route.example/".to_owned()]
    );
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

fn profile_input(profile_pubkey: String) -> ProfileLiveQueryInput {
    ProfileLiveQueryInput {
        owner: "profile-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        profile_pubkey: profile_pubkey.clone(),
        author_routes: vec![
            route(profile_pubkey, "https://profile-route.example"),
            route(pubkey("a"), "https://wrong-route.example"),
        ],
        disabled_relays: Vec::new(),
        since: Some(now_sec()),
        now_sec: now_sec(),
        page_size: 30,
    }
}

fn notifications_input(account_pubkey: String) -> NotificationsLiveQueryInput {
    NotificationsLiveQueryInput {
        owner: "notifications-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        account_pubkey: account_pubkey.clone(),
        author_routes: vec![
            route(account_pubkey, "https://notify-route.example"),
            route(pubkey("a"), "https://wrong-route.example"),
        ],
        disabled_relays: Vec::new(),
        since: Some(now_sec()),
        now_sec: now_sec(),
        page_size: 30,
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
