use crate::{EventDisplayContext, FeedViewModelInput, build_feed_view_model};

use super::CustomRequestFeedView;
use super::{CustomRequestFeedViewInput, state::custom_request_state};

#[must_use]
pub fn build_custom_request_feed_view(input: CustomRequestFeedViewInput) -> CustomRequestFeedView {
    let feed_id = custom_request_feed_id(&input.owner);
    let mut state_rows = Vec::new();
    let (status, demand, relays, footer) = custom_request_state(
        &input.run_plan,
        &input.source_state,
        &input.window,
        &feed_id,
        &mut state_rows,
    );
    let window = input.window.clone();
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::CustomRequest,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    CustomRequestFeedView {
        status,
        demand,
        relays,
        window,
        view_model,
    }
}

#[must_use]
pub fn custom_request_feed_id(owner: &str) -> String {
    format!("custom-request:{owner}")
}
