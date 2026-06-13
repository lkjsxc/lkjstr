use std::collections::BTreeSet;

use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, empty_feed_window};

use super::{
    HomeFeedSourceState, HomeFeedView, HomeFeedViewInput, HomeFollowState, build_home_feed_view,
};

#[must_use]
pub fn home_authors(active_pubkey: &str, follow_pubkeys: &[String]) -> Vec<String> {
    std::iter::once(active_pubkey.to_owned())
        .chain(follow_pubkeys.iter().cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

#[must_use]
pub fn default_home_feed_view(owner: &str, active_pubkey: Option<String>) -> HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: owner.to_owned(),
        active_pubkey,
        follow_state: HomeFollowState::Loading,
        source_state: HomeFeedSourceState::Pending,
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}
