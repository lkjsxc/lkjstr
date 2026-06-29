use lkjstr_relays::DemandVisibility;

use crate::{
    FeedFragmentConfig, ProtectedAccountAvailability, RowGeometryModel, empty_feed_window,
};

use super::{
    NotificationsFeedSourceState, NotificationsFeedView, NotificationsFeedViewInput,
    build_notifications_feed_view,
};

#[must_use]
pub fn default_notifications_feed_view(
    owner: &str,
    active_pubkey: Option<String>,
) -> NotificationsFeedView {
    build_notifications_feed_view(NotificationsFeedViewInput {
        owner: owner.to_owned(),
        account: ProtectedAccountAvailability::initial(active_pubkey),
        source_state: NotificationsFeedSourceState::Pending,
        selected_relays: Vec::new(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        now_sec: 0,
        page_size: 30,
        window: empty_feed_window(1, 180),
        notification_rows: Vec::new(),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}
