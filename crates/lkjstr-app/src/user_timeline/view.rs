use crate::{
    EventDisplayContext, FeedViewModelInput, build_feed_view_model, footer_row_from_window,
};

use super::{
    UserTimelineFeedView, UserTimelineFeedViewInput,
    state::{diagnostic_rows, user_timeline_state},
};

#[must_use]
pub fn build_user_timeline_feed_view(input: UserTimelineFeedViewInput) -> UserTimelineFeedView {
    let feed_id = user_timeline_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    let (status, live_query, author_set, footer) =
        user_timeline_state(&input, &feed_id, &mut state_rows);
    let footer = footer.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::UserTimeline,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    UserTimelineFeedView {
        status,
        live_query,
        author_set,
        view_model,
    }
}

#[must_use]
pub fn user_timeline_feed_id(owner: &str) -> String {
    format!("user-timeline:{owner}")
}
