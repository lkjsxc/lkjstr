use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    HomeFeedSourceState, HomeFeedStatus, HomeFeedViewInput, HomeFollowState, RowGeometryModel,
    build_home_feed_view, empty_feed_window, feed_event_row_id, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    DemandVisibility, PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot,
    ProgressiveReadStatus,
};

#[test]
fn home_feed_relay_progressive_snapshot_renders_real_rows() {
    let event = progressive(3);
    let window = reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot: snapshot(vec![event.clone()]),
            flags: FeedWindowFlags::default(),
        },
    );
    let model = build_home_feed_view(input(window));

    assert_eq!(model.status, HomeFeedStatus::Ready);
    assert!(model.live_query.is_some());
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(3)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::ReadingRelays
    ));
}

fn input(window: lkjstr_app::FeedWindowState) -> HomeFeedViewInput {
    HomeFeedViewInput {
        owner: "tab-a".to_owned(),
        active_pubkey: Some(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::RelayProgressive,
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

fn snapshot(events: Vec<ProgressiveEvent>) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "home-read".to_owned(),
        surface: Some(PageReadSurface::Home),
        status: ProgressiveReadStatus::Partial,
        reason: "relay-event".to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 10,
        updated_at_ms: 20,
        duration_ms: 10,
        final_read: false,
    }
}

fn progressive(value: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("b"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("relay event {value}"),
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
