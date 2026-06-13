#![doc = "Pure Search feed view-model composition."]

mod build;
mod defaults;
mod types;

pub use build::{build_search_feed_view, search_feed_id};
pub use defaults::{default_search_feed_view, partial_search_feed_view, pending_search_feed_view};
pub use types::{
    SearchFeedDiagnosticInput, SearchFeedSourceState, SearchFeedStatus, SearchFeedView,
    SearchFeedViewInput,
};
