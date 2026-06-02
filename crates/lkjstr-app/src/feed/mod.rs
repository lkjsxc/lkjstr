#![doc = "Pure feed runtime reducers."]

mod reducer;
mod runtime;
mod runtime_types;
mod surface_input_types;
mod surface_inputs;
mod types;

pub use reducer::{empty_feed_window, feed_window_empty_ready, reduce_feed_window};
pub use runtime::{
    attach_feed_runtime_live, reduce_feed_runtime_window, release_feed_runtime_live,
    set_feed_runtime_visibility, start_feed_runtime,
};
pub use runtime_types::{
    FeedRuntimeInput, FeedRuntimeLeaseOutcome, FeedRuntimeLiveOutcome, FeedRuntimeState,
};
pub use surface_input_types::{
    FeedLiveQueryInput, NotificationsLiveQueryInput, ProfileLiveQueryInput,
};
pub use surface_inputs::{
    global_live_query_input, home_live_query_input, notifications_live_query_input,
    profile_live_query_input,
};
pub use types::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, FeedWindowStatus,
};
