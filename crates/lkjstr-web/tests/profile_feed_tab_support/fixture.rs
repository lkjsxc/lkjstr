use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, FeedFragmentConfig,
    FeedWindowEvidence, FeedWindowFlags, ProfileFeedSourceState, ProfileFeedView,
    ProfileFeedViewInput, ProfileHeaderView, RowGeometryModel, StartupInput, TargetFollowListState,
    UserTimelineDiscoveryInput, UserTimelineFeedSourceState, UserTimelineFeedViewInput,
    build_profile_feed_view, build_user_timeline_feed_view, default_recovery_ids,
    empty_feed_window, followees_view_from_summary, plan_user_timeline_discovery,
    reduce_feed_window, summarize_follow_list, user_timeline_author_set,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent};
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

pub fn followees_provider() -> lkjstr_ui::FolloweesProvider {
    lkjstr_ui::FolloweesProvider::new(|request| {
        let event = follow_list_event();
        request.complete(followees_view_from_summary(
            &request.owner,
            request.target_pubkey.clone(),
            TargetFollowListState::Found,
            summarize_follow_list(&event),
        ));
    })
}

pub fn user_timeline_provider() -> lkjstr_ui::UserTimelineProvider {
    lkjstr_ui::UserTimelineProvider::new(|request| {
        let Some(target) = request.target_pubkey.clone() else {
            request.complete(lkjstr_app::default_user_timeline_feed_view(
                &request.owner,
                None,
            ));
            return;
        };
        let follow_list = follow_list_event();
        let owner = request.owner.clone();
        request.complete(build_user_timeline_feed_view(UserTimelineFeedViewInput {
            owner,
            target_pubkey: Some(target.clone()),
            discovery: plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
                groups: vec![DiscoveryRouteGroup {
                    source: DiscoveryRouteSource::Selected,
                    relays: vec!["wss://selected.example".to_owned()],
                    outcome: DiscoveryRouteOutcome::Succeeded,
                }],
                cache_checked: true,
                follow_list_found: true,
                target_posts_reachable: false,
                offline: false,
            }),
            author_set: Some(user_timeline_author_set(&target, Some(&follow_list))),
            source_state: UserTimelineFeedSourceState::CacheComplete,
            selected_relays: vec!["wss://selected.example".to_owned()],
            disabled_relays: Vec::new(),
            author_routes: Vec::new(),
            visibility: DemandVisibility::Visible,
            since: Some(1_700_000_000),
            now_sec: 1_700_000_030,
            page_size: 30,
            window: timeline_window(),
            width_px: 680,
            font_scale: 1.0,
            geometry_models: Vec::<RowGeometryModel>::new(),
            fragment_config: FeedFragmentConfig::default(),
            diagnostics: Vec::new(),
        }));
    })
}

fn follow_list_event() -> NostrEvent {
    NostrEvent {
        id: "3".repeat(64),
        pubkey: pubkey("a"),
        created_at: 1_700_000_002,
        kind: KIND_FOLLOW_LIST,
        tags: follow_list_tags(),
        content: String::new(),
        sig: "c".repeat(128),
    }
}

fn follow_list_tags() -> Vec<Vec<String>> {
    vec![
        vec![
            "p".to_owned(),
            pubkey("b"),
            "wss://relay.example".to_owned(),
            "best friend".to_owned(),
        ],
        vec!["p".to_owned(), "bad".to_owned()],
        vec!["p".to_owned(), pubkey("b")],
        vec!["p".to_owned(), pubkey("c")],
    ]
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

fn timeline_window() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![timeline_progressive()],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn timeline_progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "user-timeline".to_owned(),
        event: NostrEvent {
            id: "4".repeat(64),
            pubkey: pubkey("b"),
            created_at: 1_700_000_003,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real timeline event".to_owned(),
            sig: "d".repeat(128),
        },
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
