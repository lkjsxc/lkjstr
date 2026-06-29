use lkjstr_app::{
    FeedFragmentConfig, FeedViewRow, HomeFeedSourceState, HomeFeedStatus, HomeFeedViewInput,
    HomeFollowState, NotificationsFeedSourceState, NotificationsFeedStatus,
    NotificationsFeedViewInput, ProtectedAccountAvailability, RowGeometryModel,
    build_home_feed_view, build_notifications_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn home_storage_busy_is_not_no_active_account() {
    let view = build_home_feed_view(home_input(ProtectedAccountAvailability::StorageBusy {
        reason: "Accounts unavailable: opfs-owner-held".to_owned(),
        retry_available: true,
    }));

    assert_eq!(view.status, HomeFeedStatus::AccountStorageBusy);
    assert!(view.live_query.is_none());
    assert!(has_unavailable(
        &view.view_model.rows,
        "account-storage-busy",
        true
    ));
    assert!(!has_unavailable(
        &view.view_model.rows,
        "no-active-account",
        false
    ));
}

#[test]
fn notifications_storage_busy_is_not_no_active_account() {
    let view = build_notifications_feed_view(notifications_input(
        ProtectedAccountAvailability::StorageBusy {
            reason: "Accounts unavailable: opfs-owner-held".to_owned(),
            retry_available: true,
        },
    ));

    assert_eq!(view.status, NotificationsFeedStatus::AccountStorageBusy);
    assert!(view.live_query.is_none());
    assert!(has_unavailable(
        &view.view_model.rows,
        "account-storage-busy",
        true
    ));
    assert!(!has_unavailable(
        &view.view_model.rows,
        "no-active-account",
        false
    ));
}

fn home_input(account: ProtectedAccountAvailability) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "home-tab".to_owned(),
        account,
        follow_state: HomeFollowState::Loading,
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
    }
}

fn notifications_input(account: ProtectedAccountAvailability) -> NotificationsFeedViewInput {
    NotificationsFeedViewInput {
        owner: "notifications-tab".to_owned(),
        account,
        source_state: NotificationsFeedSourceState::Pending,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: empty_feed_window(1, 180),
        notification_rows: Vec::new(),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    }
}

fn has_unavailable(rows: &[FeedViewRow], reason: &str, retry_available: bool) -> bool {
    rows.iter().any(|row| {
        matches!(
            row,
            FeedViewRow::Unavailable(item)
                if item.reason == reason && item.retry_available == retry_available
        )
    })
}
