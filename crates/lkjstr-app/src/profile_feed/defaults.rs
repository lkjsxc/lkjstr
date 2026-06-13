use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, RowGeometryModel, empty_feed_window};

use super::{
    ProfileFeedSourceState, ProfileFeedView, ProfileFeedViewInput, build_profile_feed_view,
};

#[must_use]
pub fn default_profile_feed_view(owner: &str, profile_pubkey: Option<String>) -> ProfileFeedView {
    build_profile_feed_view(ProfileFeedViewInput {
        owner: owner.to_owned(),
        profile_pubkey,
        profile_header: None,
        source_state: ProfileFeedSourceState::Pending,
        selected_relays: Vec::new(),
        profile_hint_relays: Vec::new(),
        relay_sets_json: "[]".to_owned(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}
