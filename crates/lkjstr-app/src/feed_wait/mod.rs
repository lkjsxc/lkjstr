#![doc = "Pure feed wait and late merge reducers."]

mod empty_state;
mod late_merge;
mod policy;
mod scroll_anchor;

pub use empty_state::{EmptyProofInput, feed_empty_is_terminal};
pub use late_merge::{FeedWaitEventRow, LateMergeResult, merge_late_event_rows};
pub use policy::{
    CONTEXT_UNAVAILABLE_WAIT_MS, FIRST_PAINT_DELAY_MS, FOREGROUND_MERGE_WINDOW_MS,
    FeedWaitDecision, FeedWaitInput, FeedWaitState, decide_feed_wait,
    within_foreground_merge_window,
};
pub use scroll_anchor::{ScrollAnchor, ScrollAnchorDecision, scroll_anchor_for_late_insert};

#[cfg(test)]
mod tests;
