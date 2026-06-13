use lkjstr_app::{
    AuthorContextFeedSourceState, AuthorContextFeedView, AuthorContextFeedViewInput,
    FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel,
    empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility, ProgressiveEvent, RouteEvidenceSource};

pub fn input(
    event_id: Option<String>,
    author_pubkey: Option<String>,
    source_state: AuthorContextFeedSourceState,
    selected_relays: Vec<String>,
    anchor_created_at: Option<u64>,
    window: lkjstr_app::FeedWindowState,
) -> AuthorContextFeedViewInput {
    AuthorContextFeedViewInput {
        owner: "author-context-tab".to_owned(),
        event_id,
        author_pubkey,
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        anchor_created_at,
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

pub fn window_with_event(value: u64) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(value)],
            flags: FeedWindowFlags::default(),
        },
    )
}

pub fn has_reason(model: &AuthorContextFeedView, reason: &str) -> bool {
    model
        .view_model
        .rows
        .iter()
        .any(|row| matches!(row, FeedViewRow::Unavailable(item) if item.reason == reason))
}

pub fn selected_relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

pub fn author_route() -> AuthorRelayRoute {
    AuthorRelayRoute {
        author: pubkey("a"),
        relay_url: "wss://author.example".to_owned(),
        source: RouteEvidenceSource::Nip65,
        score: 0,
    }
}

pub fn id(value: u64) -> String {
    format!("{value:064x}")
}

pub fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn progressive(value: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: selected_relays(),
        sub_id: "author-context".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("a"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("real author context event {value}"),
            sig: "b".repeat(128),
        },
    }
}
