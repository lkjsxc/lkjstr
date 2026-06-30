use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    ProfileFeedDiagnosticInput, ProfileFeedSourceState, ProfileFeedStatus, ProfileFeedViewInput,
    RowGeometryModel, build_profile_feed_view, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn profile_feed_renders_relay_event_with_cache_unavailable_diagnostic() {
    let mut input = profile_input(window_with_event());
    input.diagnostics.push(ProfileFeedDiagnosticInput {
        scope: "profile-provider".to_owned(),
        id: "cache-events".to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: "Cached Profile events unavailable: broker-missing".to_owned(),
    });
    let model = build_profile_feed_view(input);

    assert_eq!(model.status, ProfileFeedStatus::Ready);
    assert!(
        model
            .view_model
            .rows
            .iter()
            .any(|row| { matches!(row, FeedViewRow::Event(event) if event.event_id == id()) })
    );
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Diagnostic(item) if item.message.contains("Cached Profile events unavailable"))
    }));
}

fn profile_input(window: lkjstr_app::FeedWindowState) -> ProfileFeedViewInput {
    ProfileFeedViewInput {
        owner: "profile-tab".to_owned(),
        profile_pubkey: Some(pubkey()),
        profile_header: None,
        source_state: ProfileFeedSourceState::RelayProgressive,
        selected_relays: relays(),
        profile_hint_relays: relays(),
        relay_sets_json: "[]".to_owned(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_699_999_970),
        now_sec: 1_700_000_000,
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
            events: vec![ProgressiveEvent {
                relays: relays(),
                sub_id: "profile".to_owned(),
                event: NostrEvent {
                    id: id(),
                    pubkey: pubkey(),
                    created_at: 1_699_999_990,
                    kind: KIND_TEXT_NOTE,
                    tags: Vec::new(),
                    content: "relay profile note".to_owned(),
                    sig: "b".repeat(128),
                },
            }],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn id() -> String {
    "1".repeat(64)
}

fn pubkey() -> String {
    "a".repeat(64)
}
