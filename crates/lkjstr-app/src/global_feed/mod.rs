#![doc = "Pure Global feed view-model composition."]

mod build;
mod defaults;
mod paging;
mod types;

pub use build::{build_global_feed_view, global_feed_id};
pub use defaults::default_global_feed_view;
pub use paging::{
    GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS, GlobalHistoryExhaustion, GlobalOlderBlockReason,
    GlobalOlderIntent, GlobalOlderIntentInput, GlobalOlderLoadTrigger, GlobalOlderPageInput,
    GlobalOlderPageOutcome, GlobalRelayCursor, global_cursor_contains, older_global_cursor,
    plan_global_older_intent, plan_global_older_page,
};
pub use types::{
    GlobalFeedDiagnosticInput, GlobalFeedSourceState, GlobalFeedStatus, GlobalFeedView,
    GlobalFeedViewInput,
};
