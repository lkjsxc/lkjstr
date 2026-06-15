use crate::{
    EventDisplayContext, FeedFooterState, FeedStateRow, FeedViewModelInput, build_feed_view_model,
    footer_row, footer_row_from_window, unavailable_state_row,
};

use super::queries::{anchor_query, diagnostic_rows, nearby_query};
use super::{
    AuthorContextFeedSourceState, AuthorContextFeedStatus, AuthorContextFeedView,
    AuthorContextFeedViewInput,
};

type ContextState = (
    AuthorContextFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
);

#[must_use]
pub fn build_author_context_feed_view(input: AuthorContextFeedViewInput) -> AuthorContextFeedView {
    let feed_id = author_context_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let (status, anchor_query, nearby_query, footer_state) =
        context_state(&input, &feed_id, &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::AuthorContext,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    AuthorContextFeedView {
        status,
        anchor_query,
        nearby_query,
        view_model,
    }
}

#[must_use]
pub fn author_context_feed_id(owner: &str) -> String {
    format!("author-context:{owner}")
}

fn context_state(
    input: &AuthorContextFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> ContextState {
    let Some(event_id) = input.event_id.clone() else {
        state_rows.push(unavailable_state_row(
            "missing-author-context-event",
            "author-context",
            "Author Context needs a target event before loading nearby author posts.",
            false,
        ));
        return blocked(AuthorContextFeedStatus::MissingEvent, feed_id);
    };
    let Some(author_pubkey) = input.author_pubkey.clone() else {
        state_rows.push(unavailable_state_row(
            "missing-author-context-author",
            "author-context",
            "Author Context needs the target event author before loading nearby posts.",
            false,
        ));
        return blocked(AuthorContextFeedStatus::MissingAuthor, feed_id);
    };
    if input.selected_relays.is_empty() && input.author_routes.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            &author_pubkey,
            "Author Context needs at least one enabled read relay or author route.",
            true,
        ));
        return blocked(AuthorContextFeedStatus::NoEnabledRelay, feed_id);
    }
    ready_state(input, feed_id, event_id, author_pubkey, state_rows)
}

fn ready_state(
    input: &AuthorContextFeedViewInput,
    feed_id: &str,
    event_id: String,
    author_pubkey: String,
    state_rows: &mut Vec<FeedStateRow>,
) -> ContextState {
    let anchor_query = Some(anchor_query(input, &event_id, &author_pubkey));
    let nearby_query = input
        .anchor_created_at
        .map(|created_at| nearby_query(input, created_at, &author_pubkey));
    if nearby_query.is_none() {
        state_rows.push(unavailable_state_row(
            "missing-author-context-anchor-time",
            "author-context",
            "Author Context needs the anchor event timestamp before nearby author reads.",
            true,
        ));
        return (
            AuthorContextFeedStatus::Partial,
            anchor_query,
            nearby_query,
            Some(footer_row(feed_id, FeedFooterState::Partial)),
        );
    }
    match &input.source_state {
        AuthorContextFeedSourceState::CacheComplete => {
            cache_complete(input, feed_id, anchor_query, nearby_query)
        }
        AuthorContextFeedSourceState::Partial {
            reason,
            retry_available,
        } => partial_state(
            feed_id,
            state_rows,
            reason,
            *retry_available,
            anchor_query,
            nearby_query,
        ),
        AuthorContextFeedSourceState::Pending => (
            AuthorContextFeedStatus::Loading,
            anchor_query,
            nearby_query,
            None,
        ),
        AuthorContextFeedSourceState::RelayProgressive => (
            AuthorContextFeedStatus::Ready,
            anchor_query,
            nearby_query,
            None,
        ),
    }
}

fn cache_complete(
    input: &AuthorContextFeedViewInput,
    feed_id: &str,
    anchor_query: Option<crate::QueryDemandInput>,
    nearby_query: Option<crate::QueryDemandInput>,
) -> ContextState {
    let state = if input.window.visible_events().is_empty() {
        FeedFooterState::TerminalEmpty
    } else {
        FeedFooterState::CacheHit
    };
    (
        AuthorContextFeedStatus::Ready,
        anchor_query,
        nearby_query,
        Some(footer_row(feed_id, state)),
    )
}

fn partial_state(
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
    reason: &str,
    retry_available: bool,
    anchor_query: Option<crate::QueryDemandInput>,
    nearby_query: Option<crate::QueryDemandInput>,
) -> ContextState {
    state_rows.push(unavailable_state_row(
        "partial-author-context-coverage",
        "author-context",
        reason,
        retry_available,
    ));
    (
        AuthorContextFeedStatus::Partial,
        anchor_query,
        nearby_query,
        Some(footer_row(feed_id, FeedFooterState::Partial)),
    )
}

fn blocked(status: AuthorContextFeedStatus, feed_id: &str) -> ContextState {
    (
        status,
        None,
        None,
        Some(footer_row(
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        )),
    )
}
