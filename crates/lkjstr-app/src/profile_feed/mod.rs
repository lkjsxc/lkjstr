#![doc = "Pure Profile feed view-model composition."]

mod build;
mod defaults;
mod header;
mod relay_sets_json;
mod types;

pub use build::{build_profile_feed_view, profile_feed_id};
pub use defaults::default_profile_feed_view;
pub use header::{
    ProfileHeaderInput, profile_header_or_default, profile_header_view,
    profile_header_with_copy_context, profile_header_with_relays, profile_npub,
};
pub use relay_sets_json::relay_sets_copy_json;
pub use types::{
    ProfileFeedDiagnosticInput, ProfileFeedSourceState, ProfileFeedStatus, ProfileFeedView,
    ProfileFeedViewInput, ProfileHeaderView,
};
