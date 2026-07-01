use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedViewRow, ProfileFeedSourceState, ProfileFeedStatus,
    ProfileFeedViewInput, RowGeometryModel, build_profile_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn recent_complete_empty_profile_searches_older_history() {
    let model = build_profile_feed_view(input(ProfileFeedSourceState::CacheComplete));

    assert_eq!(model.status, ProfileFeedStatus::Partial);
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(
            row,
            FeedViewRow::Unavailable(item)
                if item.reason == "searching-older-profile-history"
        )
    }));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::ReadingRelays
    ));
}

#[test]
fn profile_empty_footer_requires_sparse_absence_proof() {
    let model = build_profile_feed_view(input(ProfileFeedSourceState::EmptyProven));

    assert_eq!(model.status, ProfileFeedStatus::Ready);
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::TerminalEmpty
    ));
}

fn input(source_state: ProfileFeedSourceState) -> ProfileFeedViewInput {
    ProfileFeedViewInput {
        owner: "profile-tab".to_owned(),
        profile_pubkey: Some("a".repeat(64)),
        profile_header: None,
        source_state,
        read_plan: read_plan(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        profile_hint_relays: vec!["wss://selected.example".to_owned()],
        relay_sets_json: "[]".to_owned(),
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
    }
}

fn read_plan() -> lkjstr_app::read_availability::EffectiveReadRelays {
    lkjstr_app::read_availability::EffectiveReadRelays::from_durable_settings(vec![
        "wss://selected.example".to_owned(),
    ])
}
