#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState, HomeFeedView,
    HomeFeedViewInput, HomeFollowState, RowGeometryModel, StartupInput, build_home_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

pub const NEW_EVENT_VALUE: u64 = 60;
pub const OLD_TOP_EVENT_VALUE: u64 = 40;
pub const ANCHOR_EVENT_VALUE: u64 = 20;

pub fn initial_model() -> HomeFeedView {
    model(vec![
        event(OLD_TOP_EVENT_VALUE, &old_top_text()),
        event(ANCHOR_EVENT_VALUE, "visible anchor event"),
        event(10, &below_text()),
    ])
}

pub fn live_insert_model() -> HomeFeedView {
    model(vec![
        event(NEW_EVENT_VALUE, "new live insert event"),
        event(OLD_TOP_EVENT_VALUE, &old_top_text()),
        event(ANCHOR_EVENT_VALUE, "visible anchor event"),
        event(10, &below_text()),
    ])
}

fn model(events: Vec<ProgressiveEvent>) -> HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "home-live-insert".to_owned(),
        active_pubkey: Some(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::CacheComplete,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_080,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 240),
            FeedWindowEvidence::Events {
                generation: 1,
                events,
                flags: FeedWindowFlags::default(),
            },
        ),
        width_px: 230,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}

fn event(value: u64, content: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home-live-insert".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("b"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: content.to_owned(),
            sig: "d".repeat(128),
        },
    }
}

pub fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

fn old_top_text() -> String {
    "old top live row preserves scroll before insert ".repeat(72)
}

fn below_text() -> String {
    "below live insert anchor filler ".repeat(220)
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
