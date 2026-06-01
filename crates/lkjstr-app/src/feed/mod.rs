#![doc = "Pure feed runtime reducers."]

mod reducer;
mod types;

pub use reducer::{empty_feed_window, feed_window_empty_ready, reduce_feed_window};
pub use types::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, FeedWindowStatus,
};
