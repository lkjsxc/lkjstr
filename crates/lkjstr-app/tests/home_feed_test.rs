use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence,
    FeedWindowFlags, HomeFeedDiagnosticInput, HomeFeedSourceState, HomeFeedStatus,
    HomeFeedViewInput, HomeFollowState, RowGeometryModel, build_home_feed_view, empty_feed_window,
    feed_event_row_id, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn home_feed_loaded_follows_builds_query_and_real_event_rows() -> Result<(), String> {
    let model = build_home_feed_view(input(
        Some(pubkey("a")),
        HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b"), pubkey("a")],
        },
        HomeFeedSourceState::CacheComplete,
        window_with_event(1),
    ));

    assert_eq!(model.status, HomeFeedStatus::Ready);
    let query = model.live_query.ok_or("expected Home live query")?;
    assert_eq!(query.authors, vec![pubkey("a"), pubkey("b")]);
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(1)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn home_feed_loading_follows_does_not_scan_self_only() {
    let model = build_home_feed_view(input(
        Some(pubkey("a")),
        HomeFollowState::Loading,
        HomeFeedSourceState::Pending,
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, HomeFeedStatus::LoadingFollows);
    assert!(model.live_query.is_none());
    assert_eq!(model.view_model.rows.len(), 1);
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::Loading
    ));
}

#[test]
fn home_feed_missing_follows_stays_explicit_and_queryless() {
    let model = build_home_feed_view(input(
        Some(pubkey("a")),
        HomeFollowState::MissingComplete,
        HomeFeedSourceState::Pending,
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, HomeFeedStatus::NoFollowList);
    assert!(model.live_query.is_none());
    assert_eq!(
        model
            .view_model
            .rows
            .iter()
            .map(FeedViewRow::row_id)
            .collect::<Vec<_>>(),
        vec![
            format!("unavailable:no-follow-list:{}", pubkey("a")),
            "footer:home:tab-a".to_owned(),
        ]
    );
}

#[test]
fn home_feed_no_enabled_relay_is_queryless() {
    let mut model_input = input(
        Some(pubkey("a")),
        HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        HomeFeedSourceState::Pending,
        empty_feed_window(1, 180),
    );
    model_input.selected_relays.clear();
    let model = build_home_feed_view(model_input);

    assert_eq!(model.status, HomeFeedStatus::NoEnabledRelay);
    assert!(model.live_query.is_none());
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::ConfigurationUnavailable
    ));
}

#[test]
fn home_feed_partial_source_keeps_query_and_state_row() {
    let mut model_input = input(
        Some(pubkey("a")),
        HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        HomeFeedSourceState::Partial {
            reason: "relay coverage is incomplete".to_owned(),
            retry_available: true,
        },
        empty_feed_window(1, 180),
    );
    model_input.diagnostics.push(HomeFeedDiagnosticInput {
        scope: "relay".to_owned(),
        id: "slow-a".to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: "selected relay timed out".to_owned(),
    });
    let model = build_home_feed_view(model_input);

    assert_eq!(model.status, HomeFeedStatus::Partial);
    assert!(model.live_query.is_some());
    assert_eq!(
        model
            .view_model
            .rows
            .iter()
            .map(FeedViewRow::row_id)
            .collect::<Vec<_>>(),
        vec![
            "diagnostic:relay:slow-a",
            "unavailable:partial-home-coverage:home",
            "footer:home:tab-a",
        ]
    );
}

fn input(
    active_pubkey: Option<String>,
    follow_state: HomeFollowState,
    source_state: HomeFeedSourceState,
    window: lkjstr_app::FeedWindowState,
) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "tab-a".to_owned(),
        active_pubkey,
        follow_state,
        source_state,
        selected_relays: vec!["wss://selected.example".to_owned()],
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
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("a"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("real event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
