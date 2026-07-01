use lkjstr_app::{
    FeedFragmentConfig, FeedViewRow, HomeFeedSourceState, HomeFeedStatus, HomeFeedViewInput,
    HomeFollowState, NotificationsFeedSourceState, NotificationsFeedStatus,
    NotificationsFeedViewInput, ProtectedAccountAvailability, RowGeometryModel,
    build_home_feed_view, build_notifications_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;

#[test]
fn home_protected_account_states_are_explicit() {
    let cases = [
        (
            ProtectedAccountAvailability::NoAccounts,
            HomeFeedStatus::NoActiveAccount,
            "no-accounts",
            false,
        ),
        (
            ProtectedAccountAvailability::NoSelectedAccount,
            HomeFeedStatus::NoActiveAccount,
            "no-active-account",
            false,
        ),
        (
            ProtectedAccountAvailability::SelectorUnavailable {
                reason: "selector unavailable".to_owned(),
                retry_available: true,
            },
            HomeFeedStatus::AccountSelectorUnavailable,
            "account-selector-unavailable",
            true,
        ),
        (
            ProtectedAccountAvailability::StorageBlocked {
                reason: "blocked".to_owned(),
                retry_available: false,
            },
            HomeFeedStatus::AccountStorageUnavailable,
            "account-storage-blocked",
            false,
        ),
    ];
    for (account, status, reason, retry) in cases {
        let view = build_home_feed_view(home_input(account));
        assert_eq!(view.status, status);
        assert!(view.live_query.is_none());
        assert!(has_unavailable(&view.view_model.rows, reason, retry));
    }
}

#[test]
fn notifications_protected_account_states_are_explicit() {
    let cases = [
        (
            ProtectedAccountAvailability::NoAccounts,
            NotificationsFeedStatus::NoActiveAccount,
            "no-accounts",
            false,
        ),
        (
            ProtectedAccountAvailability::NoSelectedAccount,
            NotificationsFeedStatus::NoActiveAccount,
            "no-active-account",
            false,
        ),
        (
            ProtectedAccountAvailability::SelectorUnavailable {
                reason: "selector unavailable".to_owned(),
                retry_available: true,
            },
            NotificationsFeedStatus::AccountSelectorUnavailable,
            "account-selector-unavailable",
            true,
        ),
        (
            ProtectedAccountAvailability::StorageUnsupported {
                reason: "unsupported".to_owned(),
            },
            NotificationsFeedStatus::AccountStorageUnavailable,
            "account-storage-unsupported",
            false,
        ),
    ];
    for (account, status, reason, retry) in cases {
        let view = build_notifications_feed_view(notifications_input(account));
        assert_eq!(view.status, status);
        assert!(view.live_query.is_none());
        assert!(has_unavailable(&view.view_model.rows, reason, retry));
    }
}

#[test]
fn selected_account_starts_home_and_notification_queries() -> Result<(), String> {
    let home = build_home_feed_view(home_input(ProtectedAccountAvailability::selected(
        account_pubkey(),
    )));
    let notifications = build_notifications_feed_view(notifications_input(
        ProtectedAccountAvailability::selected(account_pubkey()),
    ));

    assert_eq!(home.status, HomeFeedStatus::LoadingFeed);
    assert_eq!(
        home.live_query.ok_or("expected Home query")?.authors.len(),
        2
    );
    assert_eq!(notifications.status, NotificationsFeedStatus::Loading);
    let notification_query = notifications
        .live_query
        .ok_or("expected Notifications query")?;
    assert_eq!(notification_query.filters[0].authors, None);
    assert_eq!(
        notification_query.filters[0].tags.get("p"),
        Some(&vec![account_pubkey()])
    );
    Ok(())
}

fn home_input(account: ProtectedAccountAvailability) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "home-tab".to_owned(),
        account,
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![seeded_pubkey("b")],
        },
        source_state: HomeFeedSourceState::Pending,
        selected_relays: relays(),
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
        read_plan: read_plan(),
        selected_relays: relays(),
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
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == reason && item.retry_available == retry_available)
    })
}

fn relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn read_plan() -> lkjstr_app::read_availability::EffectiveReadRelays {
    lkjstr_app::read_availability::EffectiveReadRelays::from_durable_settings(relays())
}

fn account_pubkey() -> String {
    seeded_pubkey("a")
}

fn seeded_pubkey(seed: &str) -> String {
    seed.repeat(64)
}
