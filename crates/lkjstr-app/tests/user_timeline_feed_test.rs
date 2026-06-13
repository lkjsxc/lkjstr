use lkjstr_app::{
    DiscoveryRouteGroup, DiscoveryRouteOutcome, DiscoveryRouteSource, FeedFooterState,
    FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel,
    UserTimelineDiscoveryInput, UserTimelineFeedSourceState, UserTimelineFeedStatus,
    UserTimelineFeedViewInput, build_user_timeline_feed_view, empty_feed_window, feed_event_row_id,
    plan_user_timeline_discovery, reduce_feed_window, target_posts_only_author_set,
    user_timeline_author_set, user_timeline_target_only_notice,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn user_timeline_uses_real_follow_graph_author_set_and_rows() -> Result<(), String> {
    let target = pubkey("a");
    let author_set = user_timeline_author_set(&target, Some(&follow_list_event()));
    let model = build_user_timeline_feed_view(input(
        Some(target.clone()),
        discovery(true, true, false),
        Some(author_set),
        UserTimelineFeedSourceState::CacheComplete,
        window_with_event(1, pubkey("b")),
    ));

    assert_eq!(model.status, UserTimelineFeedStatus::Ready);
    let query = model
        .live_query
        .ok_or("expected User Timeline live query")?;
    assert_eq!(query.surface, lkjstr_app::QuerySurface::UserTimeline);
    assert_eq!(query.authors, vec![target, pubkey("b")]);
    assert_eq!(
        query
            .filters
            .first()
            .and_then(|filter| filter.authors.clone()),
        Some(vec![pubkey("a"), pubkey("b")])
    );
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(1)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn user_timeline_loading_discovery_does_not_query_target_only() {
    let model = build_user_timeline_feed_view(input(
        Some(pubkey("a")),
        discovery(false, false, false),
        None,
        UserTimelineFeedSourceState::Pending,
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, UserTimelineFeedStatus::LoadingDiscovery);
    assert!(model.live_query.is_none());
    assert!(model.author_set.is_none());
}

#[test]
fn user_timeline_target_posts_only_is_explicit_and_real() -> Result<(), String> {
    let target = pubkey("a");
    let model = build_user_timeline_feed_view(input(
        Some(target.clone()),
        discovery(true, false, true),
        Some(target_posts_only_author_set(&target)),
        UserTimelineFeedSourceState::CacheComplete,
        window_with_event(2, target.clone()),
    ));

    assert_eq!(model.status, UserTimelineFeedStatus::TargetPostsOnly);
    let query = model.live_query.ok_or("expected target-only query")?;
    assert_eq!(query.authors, vec![target]);
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(
            row,
            FeedViewRow::Unavailable(item)
                if item.detail == user_timeline_target_only_notice()
        )
    }));
    Ok(())
}

fn input(
    target_pubkey: Option<String>,
    discovery: lkjstr_app::UserTimelineDiscoveryPlan,
    author_set: Option<lkjstr_app::UserTimelineAuthorSet>,
    source_state: UserTimelineFeedSourceState,
    window: lkjstr_app::FeedWindowState,
) -> UserTimelineFeedViewInput {
    UserTimelineFeedViewInput {
        owner: "timeline-tab".to_owned(),
        target_pubkey,
        discovery,
        author_set,
        source_state,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
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

fn discovery(
    cache_checked: bool,
    follow_list_found: bool,
    target_posts_reachable: bool,
) -> lkjstr_app::UserTimelineDiscoveryPlan {
    plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
        groups: vec![DiscoveryRouteGroup {
            source: DiscoveryRouteSource::Selected,
            relays: vec!["wss://selected.example".to_owned()],
            outcome: DiscoveryRouteOutcome::Succeeded,
        }],
        cache_checked,
        follow_list_found,
        target_posts_reachable,
        offline: false,
    })
}

fn window_with_event(value: u64, author: String) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(value, author)],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn progressive(value: u64, author: String) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "user-timeline".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: author,
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("real timeline event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn follow_list_event() -> NostrEvent {
    NostrEvent {
        id: "3".repeat(64),
        pubkey: pubkey("a"),
        created_at: 1_700_000_002,
        kind: KIND_FOLLOW_LIST,
        tags: vec![
            vec!["p".to_owned(), pubkey("b")],
            vec!["p".to_owned(), pubkey("b")],
            vec!["p".to_owned(), "bad".to_owned()],
        ],
        content: String::new(),
        sig: "c".repeat(128),
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
