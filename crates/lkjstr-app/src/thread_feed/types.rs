use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ThreadFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ThreadFeedStatus {
    MissingEventId,
    NoEnabledRelay,
    Loading,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ThreadFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct ThreadFeedViewInput {
    pub owner: String,
    pub event_id: Option<String>,
    pub root_event_id: Option<String>,
    pub root_author: Option<String>,
    pub source_state: ThreadFeedSourceState,
    pub unavailable_parent_ids: Vec<String>,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub visibility: DemandVisibility,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub diagnostics: Vec<ThreadFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ThreadFeedView {
    pub status: ThreadFeedStatus,
    pub root_lookup: Option<QueryDemandInput>,
    pub replies_query: Option<QueryDemandInput>,
    pub view_model: FeedViewModel,
}
