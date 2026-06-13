use lkjstr_app::{
    FeedFooterState, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    QuerySurface, RowGeometryModel, SearchFeedSourceState, SearchFeedStatus, SearchFeedViewInput,
    build_search_feed_view, default_search_feed_view, empty_feed_window, feed_event_row_id,
    pending_search_feed_view, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn search_feed_default_is_idle_and_queryless() {
    let model = default_search_feed_view("search-tab");

    assert_eq!(model.status, SearchFeedStatus::Idle);
    assert!(model.submitted_query.is_none());
    assert!(model.remote_query.is_none());
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::TerminalEmpty
    ));
}

#[test]
fn search_feed_empty_submit_stays_idle() {
    let model = build_search_feed_view(input(
        Some("   ".to_owned()),
        SearchFeedSourceState::CacheComplete,
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, SearchFeedStatus::Idle);
    assert!(model.submitted_query.is_none());
    assert!(model.remote_query.is_none());
}

#[test]
fn search_feed_submitted_query_builds_nip50_demand_and_real_rows() -> Result<(), String> {
    let model = build_search_feed_view(input(
        Some("  nostr wasm  ".to_owned()),
        SearchFeedSourceState::CacheComplete,
        window_with_event(),
    ));

    assert_eq!(model.status, SearchFeedStatus::Ready);
    assert_eq!(model.submitted_query.as_deref(), Some("nostr wasm"));
    let query = model.remote_query.ok_or("expected Search query demand")?;
    assert_eq!(query.surface, QuerySurface::Search);
    assert_eq!(query.selected_relays, relays());
    assert_eq!(
        query
            .filters
            .first()
            .and_then(|filter| filter.search.as_deref()),
        Some("nostr wasm")
    );
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(1)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn search_feed_cache_complete_exposes_older_footer_when_cache_has_more_rows() {
    let model = build_search_feed_view(input(
        Some("nostr".to_owned()),
        SearchFeedSourceState::CacheComplete,
        window_with_event_and_older_page(),
    ));

    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row))
            if row.state == FeedFooterState::OlderLoadReady && row.command.is_some()
    ));
}

#[test]
fn search_feed_partial_provider_gap_stays_explicit() {
    let model = build_search_feed_view(input(
        Some("nostr".to_owned()),
        SearchFeedSourceState::Partial {
            reason: "Rust Search provider execution is not wired yet.".to_owned(),
            retry_available: false,
        },
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, SearchFeedStatus::Partial);
    assert!(model.remote_query.is_some());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item)
            if item.reason == "partial-search-coverage"
                && item.detail.contains("not wired yet"))
    }));
}

#[test]
fn search_feed_pending_submit_preserves_query_and_waits_for_rows() {
    let model = pending_search_feed_view("search-tab", "  nostr wasm  ");

    assert_eq!(model.status, SearchFeedStatus::Ready);
    assert_eq!(model.submitted_query.as_deref(), Some("nostr wasm"));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::Loading
    ));
}

fn input(
    submitted_query: Option<String>,
    source_state: SearchFeedSourceState,
    window: lkjstr_app::FeedWindowState,
) -> SearchFeedViewInput {
    SearchFeedViewInput {
        owner: "search-tab".to_owned(),
        submitted_query,
        source_state,
        selected_relays: relays(),
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        until: Some(1_700_000_100),
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

fn window_with_event() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive()],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn window_with_event_and_older_page() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive()],
            flags: FeedWindowFlags {
                has_older: true,
                ..FeedWindowFlags::default()
            },
        },
    )
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: relays(),
        sub_id: "search".to_owned(),
        event: NostrEvent {
            id: id(1),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real search event".to_owned(),
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
