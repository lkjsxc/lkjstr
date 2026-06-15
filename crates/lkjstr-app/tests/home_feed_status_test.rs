use lkjstr_app::{
    FeedFragmentConfig, HomeFeedSourceState, HomeFeedStatus, HomeFeedViewInput, HomeFollowState,
    RowGeometryModel, build_home_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn home_feed_pending_after_follows_load_is_loading_not_ready() {
    let model = build_home_feed_view(HomeFeedViewInput {
        owner: "tab-a".to_owned(),
        active_pubkey: Some(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::Pending,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    });

    assert_eq!(model.status, HomeFeedStatus::LoadingFeed);
    assert!(model.live_query.is_some());
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
