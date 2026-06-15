use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    ProfileFeedSourceState, ProfileFeedStatus, ProfileFeedViewInput, RowGeometryModel,
    build_profile_feed_view, empty_feed_window, feed_event_row_id, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility, ProgressiveEvent, RouteEvidenceSource};

#[test]
fn profile_feed_builds_author_query_and_real_event_rows() -> Result<(), String> {
    let model = build_profile_feed_view(input(
        Some(pubkey("a")),
        ProfileFeedSourceState::CacheComplete,
        selected_relays(),
        window_with_event(1),
    ));

    assert_eq!(model.status, ProfileFeedStatus::Ready);
    let query = model.live_query.ok_or("expected Profile live query")?;
    assert_eq!(query.surface, lkjstr_app::QuerySurface::Profile);
    assert_eq!(query.authors, vec![pubkey("a")]);
    assert_eq!(
        query
            .filters
            .first()
            .and_then(|filter| filter.authors.clone()),
        Some(vec![pubkey("a")])
    );
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(1)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn profile_feed_missing_pubkey_is_queryless() {
    let model = build_profile_feed_view(input(
        None,
        ProfileFeedSourceState::Pending,
        selected_relays(),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, ProfileFeedStatus::MissingPubkey);
    assert!(model.live_query.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "missing-profile-pubkey")
    }));
}

#[test]
fn profile_feed_requires_selected_relay_or_author_route() {
    let model = build_profile_feed_view(input(
        Some(pubkey("a")),
        ProfileFeedSourceState::Pending,
        Vec::new(),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, ProfileFeedStatus::NoEnabledRelay);
    assert!(model.live_query.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "no-enabled-relay")
    }));
}

#[test]
fn profile_feed_accepts_author_routes_without_selected_fallback() -> Result<(), String> {
    let mut input = input(
        Some(pubkey("a")),
        ProfileFeedSourceState::Pending,
        Vec::new(),
        empty_feed_window(1, 180),
    );
    input.author_routes = vec![author_route()];
    let model = build_profile_feed_view(input);

    assert_eq!(model.status, ProfileFeedStatus::Loading);
    let query = model.live_query.ok_or("expected Profile live query")?;
    assert!(query.selected_relays.is_empty());
    assert_eq!(query.author_routes, vec![author_route()]);
    Ok(())
}

#[test]
fn profile_feed_partial_coverage_keeps_query_and_state_row() {
    let model = build_profile_feed_view(input(
        Some(pubkey("a")),
        ProfileFeedSourceState::Partial {
            reason: "profile route coverage is incomplete".to_owned(),
            retry_available: true,
        },
        selected_relays(),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, ProfileFeedStatus::Partial);
    assert!(model.live_query.is_some());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "partial-profile-coverage")
    }));
}

fn input(
    profile_pubkey: Option<String>,
    source_state: ProfileFeedSourceState,
    selected_relays: Vec<String>,
    window: lkjstr_app::FeedWindowState,
) -> ProfileFeedViewInput {
    ProfileFeedViewInput {
        owner: "profile-tab".to_owned(),
        profile_pubkey,
        profile_header: None,
        source_state,
        selected_relays: selected_relays.clone(),
        profile_hint_relays: selected_relays,
        relay_sets_json: "[]".to_owned(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    }
}

fn window_with_event(value: u64) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(value)],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn progressive(value: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: selected_relays(),
        sub_id: "profile".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("a"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("real profile event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn selected_relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn author_route() -> AuthorRelayRoute {
    AuthorRelayRoute {
        author: pubkey("a"),
        relay_url: "wss://author.example".to_owned(),
        source: RouteEvidenceSource::Nip65,
        score: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
