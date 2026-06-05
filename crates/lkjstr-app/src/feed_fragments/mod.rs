#![doc = "Pure feed visual-fragment planner for oversized events."]

mod keys;
mod model;
mod plan;
mod text;

pub use keys::fragment_key;
pub use model::{
    EventFullRow, EventIndexedRow, EventMarkerRow, EventTextSegmentRow, FeedFragmentConfig,
    FeedVisualRow, MEDIA_ITEMS_PER_SEGMENT, OVERSIZE_ESTIMATED_HEIGHT, REFERENCES_PER_SEGMENT,
    SemanticFeedEvent, TEXT_SEGMENT_MAX_CHARS, TEXT_SEGMENT_TARGET_CHARS,
};
pub use plan::plan_feed_visual_rows;
pub use text::{TextSegment, split_text_segments};

#[cfg(test)]
mod tests;
