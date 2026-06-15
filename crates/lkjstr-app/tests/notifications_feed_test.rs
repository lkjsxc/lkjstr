use lkjstr_app::{
    EventDisplayContext, FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence,
    FeedWindowFlags, NotificationItemInput, NotificationsFeedSourceState, NotificationsFeedStatus,
    NotificationsFeedViewInput, RowGeometryModel, build_notifications_feed_view, empty_feed_window,
    feed::FeedEventContent, reduce_feed_window,
};
use lkjstr_protocol::{KIND_REACTION, KIND_REPOST, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn notifications_feed_requires_active_account() {
    let view = build_notifications_feed_view(input(None, Vec::new()));

    assert_eq!(view.status, NotificationsFeedStatus::NoActiveAccount);
    assert!(view.live_query.is_none());
    assert!(matches!(
        view.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::AuthRequired
    ));
}

#[test]
fn notifications_feed_live_query_targets_p_tag_without_author_filter() -> Result<(), String> {
    let account = pubkey("a");
    let view = build_notifications_feed_view(input(Some(account.clone()), Vec::new()));
    let query = view
        .live_query
        .ok_or_else(|| "missing live query".to_owned())?;
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(filter.authors, None);
    assert_eq!(filter.tags.get("p"), Some(&vec![account]));
    Ok(())
}

#[test]
fn notifications_feed_renders_cached_source_and_notification_rows() {
    let view = build_notifications_feed_view(input(
        Some(pubkey("a")),
        vec![NotificationItemInput {
            notification_id: "notify-1".to_owned(),
            notification_kind: "reaction".to_owned(),
            source_event_id: Some("1".repeat(64)),
        }],
    ));

    assert_eq!(view.status, NotificationsFeedStatus::Partial);
    assert!(view.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Event(event) if event.event_id == "1".repeat(64))
    }));
    assert!(view.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Notification(item) if item.notification_kind == "reaction")
    }));
    assert!(matches!(
        view.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::Partial
    ));
}

#[test]
fn notifications_feed_cache_complete_uses_cache_footer() {
    let mut input = input(Some(pubkey("a")), Vec::new());
    input.source_state = NotificationsFeedSourceState::CacheComplete;
    let view = build_notifications_feed_view(input);

    assert_eq!(view.status, NotificationsFeedStatus::Ready);
    assert!(matches!(
        view.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
}

#[test]
fn notifications_feed_pending_with_account_is_loading_not_ready() {
    let mut input = input(Some(pubkey("a")), Vec::new());
    input.source_state = NotificationsFeedSourceState::Pending;
    let view = build_notifications_feed_view(input);

    assert_eq!(view.status, NotificationsFeedStatus::Loading);
    assert!(view.live_query.is_some());
}

#[test]
fn notifications_feed_repost_event_uses_notification_context() -> Result<(), String> {
    let account = pubkey("a");
    let mut input = input(
        Some(account.clone()),
        vec![NotificationItemInput {
            notification_id: "notify-repost".to_owned(),
            notification_kind: "repost".to_owned(),
            source_event_id: Some("1".repeat(64)),
        }],
    );
    input.window = reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive_with(KIND_REPOST, "", &account)],
            flags: FeedWindowFlags::default(),
        },
    );

    let view = build_notifications_feed_view(input);
    let Some(row) = view.view_model.rows.iter().find_map(|row| match row {
        FeedViewRow::Event(event) if event.event_kind == KIND_REPOST => Some(event),
        _ => None,
    }) else {
        return Err("missing repost event row".to_owned());
    };
    let FeedEventContent::Rows(content_rows) = &row.content else {
        return Err("unexpected sensitive repost row".to_owned());
    };

    assert_eq!(row.display.context, EventDisplayContext::Notification);
    assert_eq!(row.display.geometry_context, "shared-event:notification");
    assert_eq!(
        content_rows.first().map(|item| item.text()),
        Some("Reposted target unavailable".to_owned())
    );
    Ok(())
}

fn input(
    active_pubkey: Option<String>,
    notification_rows: Vec<NotificationItemInput>,
) -> NotificationsFeedViewInput {
    let account = active_pubkey.clone().unwrap_or_else(|| pubkey("a"));
    NotificationsFeedViewInput {
        owner: "notifications-tab".to_owned(),
        active_pubkey,
        source_state: NotificationsFeedSourceState::CachedPartial {
            reason: "Cached notification records loaded without complete coverage proof."
                .to_owned(),
            retry_available: true,
        },
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive_with(KIND_REACTION, "+", &account)],
                flags: FeedWindowFlags::default(),
            },
        ),
        notification_rows,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    }
}

fn progressive_with(kind: u64, content: &str, account: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "notifications".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey("b"),
            created_at: 1_700_000_001,
            kind,
            tags: vec![vec!["p".to_owned(), account.to_owned()]],
            content: content.to_owned(),
            sig: "c".repeat(128),
        },
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
