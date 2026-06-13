#![doc = "Pure Thread feed view-model composition."]

mod build;
mod context_rows;
mod defaults;
mod paging;
mod types;

pub use build::{build_thread_feed_view, thread_feed_id};
pub use defaults::default_thread_feed_view;
pub use paging::{
    THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS, ThreadHistoryExhaustion, ThreadOlderBlockReason,
    ThreadOlderIntent, ThreadOlderIntentInput, ThreadOlderLoadTrigger, ThreadOlderPageInput,
    ThreadOlderPageOutcome, ThreadRelayCursor, older_thread_cursor, plan_thread_older_intent,
    plan_thread_older_page, thread_cursor_contains,
};
pub use types::{
    ThreadFeedDiagnosticInput, ThreadFeedSourceState, ThreadFeedStatus, ThreadFeedView,
    ThreadFeedViewInput,
};
