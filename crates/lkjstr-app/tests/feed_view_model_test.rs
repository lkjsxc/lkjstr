use lkjstr_app::{
    EventDisplayContext, FEED_LOAD_OLDER_COMMAND, FeedDiagnosticSeverity, FeedFooterState,
    FeedFragmentConfig, FeedStateRow, FeedViewModelInput, FeedViewRow, FeedWindowEvidence,
    FeedWindowFlags, RowGeometryModel, build_feed_view_model, diagnostic_state_row,
    empty_feed_window, feed_event_row_id, feed_footer_row_id, footer_row, footer_row_from_window,
    notification_state_row, profile_state_row, reduce_feed_window, unavailable_state_row,
};
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::ProgressiveEvent;

#[test]
fn feed_view_model_builds_stable_event_rows_from_window_events() -> Result<(), String> {
    let window = reduce_feed_window(
        empty_feed_window(3, 10),
        FeedWindowEvidence::Events {
            generation: 3,
            events: vec![
                progressive(1, 10, "wss://relay-a.example"),
                progressive(2, 20, "wss://relay-b.example"),
                progressive(2, 20, "wss://relay-c.example"),
            ],
            flags: FeedWindowFlags::default(),
        },
    );
    let model = build_feed_view_model(input("home", window, Vec::new()));

    assert_eq!(model.feed_id, "home");
    assert_eq!(model.rows[0].row_id(), feed_event_row_id(&id(2)));
    let FeedViewRow::Event(row) = &model.rows[0] else {
        return Err("expected event row".to_owned());
    };
    assert_eq!(row.event_id, id(2));
    assert_eq!(row.relay_provenance.len(), 2);
    assert_eq!(row.display.geometry_context, "shared-event");
    assert!(!row.visual_rows.is_empty());
    assert!(matches!(model.rows.last(), Some(FeedViewRow::Footer(_))));
    Ok(())
}

#[test]
fn feed_view_model_uses_explicit_unavailable_and_diagnostic_rows() {
    let window = empty_feed_window(1, 10);
    let unavailable = unavailable_state_row(
        "missing-coverage",
        "home",
        "relay coverage is incomplete",
        true,
    );
    let diagnostic = diagnostic_state_row(
        "relay",
        "partial-a",
        FeedDiagnosticSeverity::Warning,
        "one relay timed out",
    );
    let model = build_feed_view_model(input("home", window, vec![unavailable, diagnostic]));

    assert_eq!(
        model
            .rows
            .iter()
            .map(FeedViewRow::row_id)
            .collect::<Vec<_>>(),
        vec![
            "unavailable:missing-coverage:home",
            "diagnostic:relay:partial-a",
            "footer:home"
        ]
    );
}

#[test]
fn feed_view_model_builds_profile_state_rows_with_stable_ids() {
    let window = empty_feed_window(1, 10);
    let profile = profile_state_row("npub-profile", "Profile");
    let notification = notification_state_row("event-a", "mention", Some("root-a".to_owned()));
    let model = build_feed_view_model(input("profile", window, vec![profile, notification]));

    assert_eq!(
        model
            .rows
            .iter()
            .map(FeedViewRow::row_id)
            .collect::<Vec<_>>(),
        vec![
            "profile:npub-profile",
            "notification:event-a:mention",
            "footer:profile"
        ]
    );
}

#[test]
fn feed_view_model_footer_never_turns_pending_empty_into_success() {
    let pending = empty_feed_window(1, 10);
    let terminal = reduce_feed_window(
        empty_feed_window(1, 10),
        FeedWindowEvidence::Events {
            generation: 1,
            events: Vec::new(),
            flags: FeedWindowFlags {
                terminal: true,
                ..FeedWindowFlags::default()
            },
        },
    );

    assert_eq!(
        footer_row_from_window("home", &pending).state,
        FeedFooterState::Loading
    );
    assert_eq!(
        footer_row_from_window("home", &terminal).state,
        FeedFooterState::TerminalEmpty
    );
    assert_eq!(
        footer_row_from_window("home", &pending).row_id,
        feed_footer_row_id("home")
    );
    assert_eq!(
        footer_row("home", FeedFooterState::OlderLoadReady)
            .command
            .as_deref(),
        Some(FEED_LOAD_OLDER_COMMAND)
    );
    assert!(
        footer_row("home", FeedFooterState::TerminalWithRows)
            .command
            .is_none()
    );
}

fn input(
    feed_id: &str,
    window: lkjstr_app::FeedWindowState,
    state_rows: Vec<FeedStateRow>,
) -> FeedViewModelInput {
    let footer = footer_row_from_window(feed_id, &window);
    FeedViewModelInput {
        feed_id: feed_id.to_owned(),
        display_context: EventDisplayContext::Timeline,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        state_rows,
        footer,
    }
}

fn progressive(value: u64, created_at: u64, relay: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec![relay.to_owned()],
        sub_id: "sub-a".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: "a".repeat(64),
            created_at,
            kind: 1,
            tags: Vec::new(),
            content: format!("event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
