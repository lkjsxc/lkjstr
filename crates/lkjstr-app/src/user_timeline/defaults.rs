use lkjstr_relays::DemandVisibility;

use crate::{FeedFragmentConfig, empty_feed_window, plan_user_timeline_discovery};

use super::{
    UserTimelineDiscoveryInput, UserTimelineFeedSourceState, UserTimelineFeedView,
    UserTimelineFeedViewInput, build_user_timeline_feed_view,
};

#[must_use]
pub fn default_user_timeline_feed_view(
    owner: &str,
    target_pubkey: Option<String>,
) -> UserTimelineFeedView {
    build_user_timeline_feed_view(UserTimelineFeedViewInput {
        owner: owner.to_owned(),
        target_pubkey,
        discovery: plan_user_timeline_discovery(&UserTimelineDiscoveryInput {
            groups: Vec::new(),
            cache_checked: false,
            follow_list_found: false,
            target_posts_reachable: false,
            offline: false,
        }),
        author_set: None,
        source_state: UserTimelineFeedSourceState::Pending,
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
