use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NotificationsFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    CachedPartial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NotificationsFeedStatus {
    NoActiveAccount,
    NoEnabledRelay,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotificationsFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NotificationItemInput {
    pub notification_id: String,
    pub notification_kind: String,
    pub source_event_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct NotificationsFeedViewInput {
    pub owner: String,
    pub active_pubkey: Option<String>,
    pub source_state: NotificationsFeedSourceState,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub visibility: DemandVisibility,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
    pub window: FeedWindowState,
    pub notification_rows: Vec<NotificationItemInput>,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub diagnostics: Vec<NotificationsFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct NotificationsFeedView {
    pub status: NotificationsFeedStatus,
    pub live_query: Option<QueryDemandInput>,
    pub view_model: FeedViewModel,
}
