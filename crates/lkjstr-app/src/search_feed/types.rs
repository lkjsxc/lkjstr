use lkjstr_relays::DemandVisibility;

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SearchFeedSourceState {
    Idle,
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SearchFeedStatus {
    Idle,
    Searching,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct SearchFeedViewInput {
    pub owner: String,
    pub submitted_query: Option<String>,
    pub source_state: SearchFeedSourceState,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
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
    pub diagnostics: Vec<SearchFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SearchFeedView {
    pub status: SearchFeedStatus,
    pub submitted_query: Option<String>,
    pub remote_query: Option<QueryDemandInput>,
    pub window: FeedWindowState,
    pub view_model: FeedViewModel,
}
