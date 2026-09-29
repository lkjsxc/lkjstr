use lkjstr_app::{
    FeedFragmentConfig, FeedWindowState, HomeFeedSourceState, HomeFeedViewInput, HomeFollowState,
    ProtectedAccountAvailability,
};
use lkjstr_relays::DemandVisibility;

pub fn input(window: FeedWindowState) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "home-test".to_owned(),
        account: ProtectedAccountAvailability::selected("a".repeat(64)),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![],
        },
        source_state: HomeFeedSourceState::RelayProgressive,
        selected_relays: vec!["wss://a.example".to_owned()],
        disabled_relays: vec![],
        author_routes: vec![],
        visibility: DemandVisibility::Visible,
        since: None,
        now_sec: 20,
        page_size: 30,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: vec![],
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: vec![],
    }
}
