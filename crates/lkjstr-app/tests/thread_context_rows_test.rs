use lkjstr_app::{
    FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel,
    ThreadFeedSourceState, ThreadFeedViewInput, build_thread_feed_view, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn thread_feed_renders_terminal_unavailable_parent_rows() {
    let mut input = input(window(vec![event(2, Some(5))]));
    input.unavailable_parent_ids = vec![id(5)];
    let model = build_thread_feed_view(input);

    assert!(model.view_model.rows.iter().any(|row| {
        matches!(
            row,
            FeedViewRow::Unavailable(item)
                if item.reason == "thread-parent-unavailable"
                    && item.subject == id(5)
                    && item.retry_available
        )
    }));
}

#[test]
fn thread_feed_collapses_deep_reply_branch_into_continuation() {
    let model = build_thread_feed_view(input(window(vec![
        event(1, None),
        event(2, Some(1)),
        event(3, Some(2)),
        event(4, Some(3)),
        event(5, Some(4)),
        event(6, Some(5)),
    ])));
    let events = event_ids(&model.view_model.rows);
    let continuation = model.view_model.rows.iter().find_map(|row| match row {
        FeedViewRow::Continuation(row) => Some(row),
        _ => None,
    });

    assert!(!events.contains(&id(6)));
    assert!(matches!(
        continuation,
        Some(row) if row.target_event_id == id(6) && row.hidden_count == 1 && row.depth == 5
    ));
}

fn input(window: lkjstr_app::FeedWindowState) -> ThreadFeedViewInput {
    ThreadFeedViewInput {
        owner: "thread-tab".to_owned(),
        event_id: Some(id(2)),
        root_event_id: Some(id(1)),
        root_author: Some(pubkey()),
        source_state: ThreadFeedSourceState::CacheComplete,
        unavailable_parent_ids: Vec::new(),
        selected_relays: vec!["wss://selected.example".to_owned()],
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

fn window(events: Vec<NostrEvent>) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 240),
        FeedWindowEvidence::Events {
            generation: 1,
            events: events.into_iter().map(progressive).collect(),
            flags: FeedWindowFlags::default(),
        },
    )
}

fn progressive(event: NostrEvent) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "thread".to_owned(),
        event,
    }
}

fn event(value: u64, parent: Option<u64>) -> NostrEvent {
    NostrEvent {
        id: id(value),
        pubkey: pubkey(),
        created_at: 1_700_000_000 + value,
        kind: KIND_TEXT_NOTE,
        tags: parent
            .map(|parent| {
                vec![vec![
                    "e".to_owned(),
                    id(parent),
                    String::new(),
                    "reply".to_owned(),
                ]]
            })
            .unwrap_or_default(),
        content: format!("real thread event {value}"),
        sig: "b".repeat(128),
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

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
