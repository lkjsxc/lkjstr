use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, RowGeometryModel, empty_feed_window};

use super::{ThreadFeedSourceState, ThreadFeedView, ThreadFeedViewInput, build_thread_feed_view};

#[must_use]
pub fn default_thread_feed_view(owner: &str, event_id: Option<String>) -> ThreadFeedView {
    build_thread_feed_view(ThreadFeedViewInput {
        owner: owner.to_owned(),
        event_id,
        root_event_id: None,
        root_author: None,
        source_state: ThreadFeedSourceState::Pending,
        unavailable_parent_ids: Vec::new(),
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        until: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 240),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}
