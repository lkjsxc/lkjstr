use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, FeedViewRow, HomeFeedDiagnosticInput,
    HomeFeedSourceState, HomeFeedStatus, HomeFeedViewInput, HomeFollowState,
    NotificationsFeedDiagnosticInput, NotificationsFeedSourceState, NotificationsFeedStatus,
    NotificationsFeedViewInput, ProfileFeedDiagnosticInput, ProfileFeedSourceState,
    ProfileFeedStatus, ProfileFeedViewInput, ProtectedAccountAvailability, RowGeometryModel,
    build_home_feed_view, build_notifications_feed_view, build_profile_feed_view,
    empty_feed_window,
    read_availability::{EffectiveReadRelays, SessionDefaultReadPolicy},
};
use lkjstr_relays::DemandVisibility;

#[test]
fn home_session_default_read_plan_is_loading_not_no_enabled() {
    let plan = unavailable_allowed_plan();
    let view = build_home_feed_view(home_input(plan));

    assert_eq!(view.status, HomeFeedStatus::LoadingFeed);
    assert!(view.live_query.is_some());
    assert!(has_diagnostic(&view.view_model.rows, "relay-settings"));
}

#[test]
fn notifications_session_default_read_plan_is_loading_not_no_enabled() {
    let plan = unavailable_allowed_plan();
    let view = build_notifications_feed_view(notifications_input(plan));

    assert_eq!(view.status, NotificationsFeedStatus::Loading);
    assert!(view.live_query.is_some());
    assert!(has_diagnostic(&view.view_model.rows, "relay-settings"));
    assert!(!has_unavailable(&view.view_model.rows, "no-enabled-relay"));
}

#[test]
fn profile_session_default_read_plan_is_loading_not_no_enabled() {
    let plan = unavailable_allowed_plan();
    let view = build_profile_feed_view(profile_input(plan));

    assert_eq!(view.status, ProfileFeedStatus::Loading);
    assert!(view.live_query.is_some());
    assert!(has_diagnostic(&view.view_model.rows, "relay-settings"));
    assert!(!has_unavailable(&view.view_model.rows, "no-enabled-relay"));
}

fn unavailable_allowed_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_unavailable(
        "opfs-owner-held",
        SessionDefaultReadPolicy::Allowed,
        vec!["wss://relay.example".to_owned()],
    )
}

fn home_input(plan: EffectiveReadRelays) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "home-tab".to_owned(),
        account: ProtectedAccountAvailability::selected(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::Pending,
        selected_relays: plan.relays,
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
        diagnostics: home_diagnostics(plan.diagnostic),
    }
}

fn notifications_input(plan: EffectiveReadRelays) -> NotificationsFeedViewInput {
    NotificationsFeedViewInput {
        owner: "notifications-tab".to_owned(),
        account: ProtectedAccountAvailability::selected(pubkey("a")),
        source_state: NotificationsFeedSourceState::Pending,
        read_plan: plan.clone(),
        selected_relays: plan.relays,
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
        diagnostics: notifications_diagnostics(plan.diagnostic),
    }
}

fn profile_input(plan: EffectiveReadRelays) -> ProfileFeedViewInput {
    ProfileFeedViewInput {
        owner: "profile-tab".to_owned(),
        profile_pubkey: Some(pubkey("a")),
        profile_header: None,
        source_state: ProfileFeedSourceState::Pending,
        read_plan: plan.clone(),
        selected_relays: plan.relays.clone(),
        profile_hint_relays: plan.relays,
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
        diagnostics: profile_diagnostics(plan.diagnostic),
    }
}

fn home_diagnostics(message: Option<String>) -> Vec<HomeFeedDiagnosticInput> {
    message
        .map(|message| HomeFeedDiagnosticInput {
            scope: "home-provider".to_owned(),
            id: "relay-settings".to_owned(),
            severity: FeedDiagnosticSeverity::Warning,
            message,
        })
        .into_iter()
        .collect()
}

fn notifications_diagnostics(message: Option<String>) -> Vec<NotificationsFeedDiagnosticInput> {
    message
        .map(|message| NotificationsFeedDiagnosticInput {
            scope: "notifications-provider".to_owned(),
            id: "relay-settings".to_owned(),
            severity: FeedDiagnosticSeverity::Warning,
            message,
        })
        .into_iter()
        .collect()
}

fn profile_diagnostics(message: Option<String>) -> Vec<ProfileFeedDiagnosticInput> {
    message
        .map(|message| ProfileFeedDiagnosticInput {
            scope: "profile-provider".to_owned(),
            id: "relay-settings".to_owned(),
            severity: FeedDiagnosticSeverity::Warning,
            message,
        })
        .into_iter()
        .collect()
}

fn has_diagnostic(rows: &[FeedViewRow], id: &str) -> bool {
    rows.iter()
        .any(|row| matches!(row, FeedViewRow::Diagnostic(item) if item.diagnostic_id == id))
}

fn has_unavailable(rows: &[FeedViewRow], reason: &str) -> bool {
    rows.iter()
        .any(|row| matches!(row, FeedViewRow::Unavailable(item) if item.reason == reason))
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
