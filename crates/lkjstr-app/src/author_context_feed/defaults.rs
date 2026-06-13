use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, empty_feed_window};

use super::{
    AuthorContextFeedSourceState, AuthorContextFeedView, AuthorContextFeedViewInput,
    build_author_context_feed_view,
};

#[must_use]
pub fn default_author_context_feed_view(
    owner: &str,
    event_id: Option<String>,
    author_pubkey: Option<String>,
) -> AuthorContextFeedView {
    build_author_context_feed_view(AuthorContextFeedViewInput {
        owner: owner.to_owned(),
        event_id,
        author_pubkey,
        source_state: AuthorContextFeedSourceState::Pending,
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        anchor_created_at: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}
