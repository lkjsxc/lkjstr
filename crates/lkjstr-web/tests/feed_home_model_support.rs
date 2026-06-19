#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, RowGeometryModel, StartupInput, build_home_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

pub fn home_model() -> lkjstr_app::HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "browser-home".to_owned(),
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
    })
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

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey("a"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real home event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
