use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    RowGeometryModel, ThreadFeedSourceState, ThreadFeedStatus, ThreadFeedViewInput,
    build_thread_feed_view, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn thread_feed_builds_root_lookup_reply_query_and_rows() -> Result<(), String> {
    let model = build_thread_feed_view(input(
        Some(id(2)),
        Some(id(1)),
        ThreadFeedSourceState::CacheComplete,
        relays(),
        window_with_events(),
    ));

    assert_eq!(model.status, ThreadFeedStatus::Ready);
    assert!(matches!(
        model.root_lookup.as_ref(),
        Some(query) if query.channel.as_deref() == Some("thread-root")
    ));
    let replies = model.replies_query.ok_or("expected replies query")?;
    assert_eq!(replies.channel.as_deref(), Some("thread-replies"));
    assert_eq!(
        replies
            .filters
            .first()
            .and_then(|filter| filter.tags.get("e")),
        Some(&vec![id(1), id(2)])
    );
    let events = event_ids(&model.view_model.rows);
    assert_eq!(events, vec![id(2), id(1)]);
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn thread_feed_missing_event_id_is_queryless() {
    let model = build_thread_feed_view(input(
        None,
        None,
        ThreadFeedSourceState::Pending,
        relays(),
        empty_feed_window(1, 240),
    ));

    assert_eq!(model.status, ThreadFeedStatus::MissingEventId);
    assert!(model.root_lookup.is_none());
    assert!(model.replies_query.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item) if item.reason == "missing-thread-event")
    }));
}

#[test]
fn thread_feed_requires_relay_or_author_route() {
    let model = build_thread_feed_view(input(
        Some(id(1)),
        Some(id(1)),
        ThreadFeedSourceState::Pending,
        Vec::new(),
        empty_feed_window(1, 240),
    ));

    assert_eq!(model.status, ThreadFeedStatus::NoEnabledRelay);
    assert!(model.root_lookup.is_none());
    assert!(model.replies_query.is_none());
}

#[test]
fn thread_feed_pending_with_relays_is_loading_not_ready() {
    let event_id = id(1);
    let model = build_thread_feed_view(input(
        Some(event_id.clone()),
        Some(event_id),
        ThreadFeedSourceState::Pending,
        relays(),
        empty_feed_window(1, 240),
    ));
    assert_eq!(model.status, ThreadFeedStatus::Loading);
    assert!(model.root_lookup.is_some() && model.replies_query.is_some());
}

#[test]
fn thread_feed_partial_with_older_rows_exposes_older_footer() {
    let model = build_thread_feed_view(input(
        Some(id(1)),
        Some(id(1)),
        ThreadFeedSourceState::Partial {
            reason: "older thread pages remain partial".to_owned(),
            retry_available: true,
        },
        relays(),
        window_with_older_event(),
    ));

    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::OlderLoadReady
            && row.command.as_deref() == Some(lkjstr_app::FEED_LOAD_OLDER_COMMAND)
    ));
}

fn input(
    event_id: Option<String>,
    root_event_id: Option<String>,
    source_state: ThreadFeedSourceState,
    selected_relays: Vec<String>,
    window: lkjstr_app::FeedWindowState,
) -> ThreadFeedViewInput {
    ThreadFeedViewInput {
        owner: "thread-tab".to_owned(),
        event_id,
        root_event_id,
        root_author: Some(pubkey()),
        source_state,
        unavailable_parent_ids: Vec::new(),
        selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        until: None,
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

fn window_with_events() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 240),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(1, 1), progressive(2, 2)],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn window_with_older_event() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 240),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(1, 1)],
            flags: FeedWindowFlags {
                has_older: true,
                ..FeedWindowFlags::default()
            },
        },
    )
}

fn progressive(value: u64, created_offset: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: relays(),
        sub_id: "thread".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey(),
            created_at: 1_700_000_000 + created_offset,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("real thread event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn event_ids(rows: &[FeedViewRow]) -> Vec<String> {
    rows.iter()
        .filter_map(|row| match row {
            FeedViewRow::Event(row) => Some(row.event_id.clone()),
            _ => None,
        })
        .collect()
}

fn relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
