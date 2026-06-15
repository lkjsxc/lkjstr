mod author_context_support;

use lkjstr_app::{
    AuthorContextFeedSourceState, AuthorContextFeedStatus, FeedFooterState, FeedViewRow,
    QuerySurface, build_author_context_feed_view, empty_feed_window, feed_event_row_id,
};

use author_context_support::{
    author_route, has_reason, id, input, pubkey, selected_relays, window_with_event,
};

#[test]
fn author_context_builds_queries_and_real_event_rows() -> Result<(), String> {
    let model = build_author_context_feed_view(input(
        Some(id(7)),
        Some(pubkey("a")),
        AuthorContextFeedSourceState::CacheComplete,
        selected_relays(),
        Some(1_700_000_010),
        window_with_event(1),
    ));

    assert_eq!(model.status, AuthorContextFeedStatus::Ready);
    assert_eq!(
        model.anchor_query.ok_or("missing anchor query")?.surface,
        QuerySurface::AuthorContext
    );
    let nearby = model.nearby_query.ok_or("missing nearby query")?;
    assert_eq!(nearby.channel.as_deref(), Some("author-context-nearby"));
    assert_eq!(nearby.until, Some(1_700_000_010));
    assert_eq!(
        nearby
            .filters
            .first()
            .and_then(|filter| filter.authors.clone()),
        Some(vec![pubkey("a")])
    );
    assert_eq!(model.view_model.rows[0].row_id(), feed_event_row_id(&id(1)));
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::CacheHit
    ));
    Ok(())
}

#[test]
fn author_context_missing_event_is_queryless() {
    let model = build_author_context_feed_view(input(
        None,
        Some(pubkey("a")),
        AuthorContextFeedSourceState::Pending,
        selected_relays(),
        Some(1_700_000_010),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, AuthorContextFeedStatus::MissingEvent);
    assert!(model.anchor_query.is_none());
    assert!(model.nearby_query.is_none());
    assert!(has_reason(&model, "missing-author-context-event"));
}

#[test]
fn author_context_missing_author_is_queryless() {
    let model = build_author_context_feed_view(input(
        Some(id(7)),
        None,
        AuthorContextFeedSourceState::Pending,
        selected_relays(),
        Some(1_700_000_010),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, AuthorContextFeedStatus::MissingAuthor);
    assert!(model.anchor_query.is_none());
    assert!(has_reason(&model, "missing-author-context-author"));
}

#[test]
fn author_context_requires_selected_relay_or_author_route() {
    let model = build_author_context_feed_view(input(
        Some(id(7)),
        Some(pubkey("a")),
        AuthorContextFeedSourceState::Pending,
        Vec::new(),
        Some(1_700_000_010),
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, AuthorContextFeedStatus::NoEnabledRelay);
    assert!(model.anchor_query.is_none());
    assert!(has_reason(&model, "no-enabled-relay"));
}

#[test]
fn author_context_accepts_author_routes_without_selected_fallback() -> Result<(), String> {
    let mut input = input(
        Some(id(7)),
        Some(pubkey("a")),
        AuthorContextFeedSourceState::Pending,
        Vec::new(),
        Some(1_700_000_010),
        empty_feed_window(1, 180),
    );
    input.author_routes = vec![author_route()];

    let model = build_author_context_feed_view(input);

    assert_eq!(model.status, AuthorContextFeedStatus::Loading);
    let anchor = model.anchor_query.ok_or("missing anchor query")?;
    assert!(anchor.selected_relays.is_empty());
    assert_eq!(anchor.author_routes, vec![author_route()]);
    Ok(())
}

#[test]
fn author_context_without_anchor_time_reads_anchor_only() {
    let model = build_author_context_feed_view(input(
        Some(id(7)),
        Some(pubkey("a")),
        AuthorContextFeedSourceState::Pending,
        selected_relays(),
        None,
        empty_feed_window(1, 180),
    ));

    assert_eq!(model.status, AuthorContextFeedStatus::Partial);
    assert!(model.anchor_query.is_some());
    assert!(model.nearby_query.is_none());
    assert!(has_reason(&model, "missing-author-context-anchor-time"));
}
