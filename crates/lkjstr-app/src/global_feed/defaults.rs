use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, empty_feed_window};

use super::{GlobalFeedSourceState, GlobalFeedView, GlobalFeedViewInput, build_global_feed_view};

#[must_use]
pub fn default_global_feed_view(owner: &str) -> GlobalFeedView {
    build_global_feed_view(GlobalFeedViewInput {
        owner: owner.to_owned(),
        source_state: GlobalFeedSourceState::Pending,
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
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
