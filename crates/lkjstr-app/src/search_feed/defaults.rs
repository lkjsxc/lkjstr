use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, empty_feed_window};

use super::{SearchFeedSourceState, SearchFeedView, SearchFeedViewInput, build_search_feed_view};

#[must_use]
pub fn default_search_feed_view(owner: &str) -> SearchFeedView {
    build_search_feed_view(default_input(owner, None, SearchFeedSourceState::Idle))
}

#[must_use]
pub fn partial_search_feed_view(
    owner: &str,
    query: &str,
    reason: &str,
    retry_available: bool,
) -> SearchFeedView {
    build_search_feed_view(default_input(
        owner,
        Some(query.to_owned()),
        SearchFeedSourceState::Partial {
            reason: reason.to_owned(),
            retry_available,
        },
    ))
}

#[must_use]
pub fn pending_search_feed_view(owner: &str, query: &str) -> SearchFeedView {
    build_search_feed_view(default_input(
        owner,
        Some(query.to_owned()),
        SearchFeedSourceState::Pending,
    ))
}

fn default_input(
    owner: &str,
    submitted_query: Option<String>,
    source_state: SearchFeedSourceState,
) -> SearchFeedViewInput {
    SearchFeedViewInput {
        owner: owner.to_owned(),
        submitted_query,
        source_state,
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        until: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    }
}
