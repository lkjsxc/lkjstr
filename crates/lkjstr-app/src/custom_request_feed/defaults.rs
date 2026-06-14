use crate::{FeedFragmentConfig, empty_feed_window};

use super::{
    CustomRequestFeedSourceState, CustomRequestFeedView, CustomRequestFeedViewInput,
    build_custom_request_feed_view,
};

#[must_use]
pub fn default_custom_request_feed_view(owner: &str) -> CustomRequestFeedView {
    build_custom_request_feed_view(empty_input(owner, CustomRequestFeedSourceState::Idle))
}

#[must_use]
pub fn planning_custom_request_feed_view(owner: &str) -> CustomRequestFeedView {
    build_custom_request_feed_view(empty_input(owner, CustomRequestFeedSourceState::Planning))
}

#[must_use]
pub fn canceled_custom_request_feed_view(owner: &str) -> CustomRequestFeedView {
    build_custom_request_feed_view(empty_input(owner, CustomRequestFeedSourceState::Canceled))
}

fn empty_input(
    owner: &str,
    source_state: CustomRequestFeedSourceState,
) -> CustomRequestFeedViewInput {
    CustomRequestFeedViewInput {
        owner: owner.to_owned(),
        run_plan: None,
        source_state,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
    }
}
