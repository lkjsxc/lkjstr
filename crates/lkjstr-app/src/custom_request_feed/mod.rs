#![doc = "Pure Custom Request feed view-model composition."]

mod build;
mod defaults;
mod state;
mod types;

pub use build::{build_custom_request_feed_view, custom_request_feed_id};
pub use defaults::{
    canceled_custom_request_feed_view, default_custom_request_feed_view,
    planning_custom_request_feed_view, unavailable_custom_request_feed_view,
};
pub use types::{
    CustomRequestFeedSourceState, CustomRequestFeedStatus, CustomRequestFeedView,
    CustomRequestFeedViewInput,
};
