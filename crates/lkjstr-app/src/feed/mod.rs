#![doc = "Pure feed runtime reducers."]

mod reducer;
mod runtime;
mod runtime_types;
mod types;

pub use reducer::{empty_feed_window, feed_window_empty_ready, reduce_feed_window};
pub use runtime::{
    attach_feed_runtime_live, reduce_feed_runtime_window, release_feed_runtime_live,
    set_feed_runtime_visibility, start_feed_runtime,
};
pub use runtime_types::{
    FeedRuntimeInput, FeedRuntimeLeaseOutcome, FeedRuntimeLiveOutcome, FeedRuntimeState,
};
pub use types::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, FeedWindowStatus,
};
