use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, ProfileFeedSourceState,
    ProfileFeedView, ProfileFeedViewInput, ProfileHeaderView, RowGeometryModel, StartupInput,
    build_profile_feed_view, default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

pub fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

pub fn profile_model() -> ProfileFeedView {
    build_profile_feed_view(ProfileFeedViewInput {
        owner: "browser-profile".to_owned(),
        profile_pubkey: Some(pubkey("a")),
        profile_header: Some(profile_header()),
        source_state: ProfileFeedSourceState::CacheComplete,
        read_plan: read_plan(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        profile_hint_relays: vec!["wss://selected.example".to_owned()],
        relay_sets_json: "[]".to_owned(),
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

fn read_plan() -> lkjstr_app::read_availability::EffectiveReadRelays {
    lkjstr_app::read_availability::EffectiveReadRelays::from_durable_settings(vec![
        "wss://selected.example".to_owned(),
    ])
}

fn profile_header() -> ProfileHeaderView {
    ProfileHeaderView {
        pubkey: pubkey("a"),
        display_name: "Rust Profile".to_owned(),
        subtitle: "rust.example".to_owned(),
        npub: "npub1rustprofile".to_owned(),
        nprofile: None,
        follow_list_json: "null".to_owned(),
        relay_sets_json: "[]".to_owned(),
        avatar_url: None,
        banner_url: None,
        about: None,
        website: None,
        following_label: "2 following".to_owned(),
        following_known: true,
    }
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "profile".to_owned(),
        event: NostrEvent {
            id: "2".repeat(64),
            pubkey: pubkey("a"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real profile event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
