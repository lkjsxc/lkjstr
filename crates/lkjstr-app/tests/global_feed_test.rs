use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, GlobalFeedSourceState,
    GlobalFeedStatus, GlobalFeedViewInput, RowGeometryModel, build_global_feed_view,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn global_feed_builds_real_event_rows_without_authors() {
    let view = build_global_feed_view(input(GlobalFeedSourceState::CacheComplete, relays()));
    let events: Vec<_> = view
        .view_model
        .rows
        .iter()
        .filter_map(|row| match row {
            lkjstr_app::FeedViewRow::Event(row) => Some(row),
            _ => None,
        })
        .collect();

    let expected_event_id = id(1);

    assert_eq!(view.status, GlobalFeedStatus::Ready);
    assert_eq!(events.len(), 1);
    assert_eq!(
        events.first().map(|event| event.event_id.as_str()),
        Some(expected_event_id.as_str())
    );
    assert!(matches!(
        view.live_query.as_ref(),
        Some(query)
            if query
                .filters
                .first()
                .is_some_and(|filter| filter.authors.is_none())
                && query.surface == lkjstr_app::QuerySurface::Global
    ));
}

#[test]
fn global_feed_requires_selected_read_relays() {
    let view = build_global_feed_view(input(GlobalFeedSourceState::Pending, Vec::new()));

    assert_eq!(view.status, GlobalFeedStatus::NoEnabledRelay);
    assert!(view.live_query.is_none());
    assert!(view.view_model.rows.iter().any(|row| {
        matches!(row, lkjstr_app::FeedViewRow::Unavailable(item) if item.reason == "no-enabled-relay")
    }));
}

#[test]
fn global_feed_partial_coverage_stays_explicit() {
    let view = build_global_feed_view(input(
        GlobalFeedSourceState::Partial {
            reason: "missing selected relay coverage".to_owned(),
            retry_available: true,
        },
        relays(),
    ));

    assert_eq!(view.status, GlobalFeedStatus::Partial);
    assert!(view.live_query.is_some());
    assert!(view.view_model.rows.iter().any(|row| {
        matches!(row, lkjstr_app::FeedViewRow::Unavailable(item) if item.reason == "partial-global-coverage")
    }));
}

fn input(source_state: GlobalFeedSourceState, selected_relays: Vec<String>) -> GlobalFeedViewInput {
    GlobalFeedViewInput {
        owner: "global-tab".to_owned(),
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive()],
                flags: FeedWindowFlags::default(),
            },
        ),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    }
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: relays(),
        sub_id: "global".to_owned(),
        event: NostrEvent {
            id: id(1),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real global event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
