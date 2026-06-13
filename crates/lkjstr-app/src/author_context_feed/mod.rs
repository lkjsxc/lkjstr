#![doc = "Pure Author Context feed view-model composition."]

mod build;
mod defaults;
mod queries;
mod types;

pub use build::{author_context_feed_id, build_author_context_feed_view};
pub use defaults::default_author_context_feed_view;
pub use types::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedStatus,
    AuthorContextFeedView, AuthorContextFeedViewInput,
};
