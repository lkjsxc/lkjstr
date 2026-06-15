use lkjstr_relays::DemandVisibility;

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GlobalFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GlobalFeedStatus {
    NoEnabledRelay,
    Loading,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GlobalFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct GlobalFeedViewInput {
    pub owner: String,
    pub source_state: GlobalFeedSourceState,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub visibility: DemandVisibility,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub diagnostics: Vec<GlobalFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GlobalFeedView {
    pub status: GlobalFeedStatus,
    pub live_query: Option<QueryDemandInput>,
    pub view_model: FeedViewModel,
}
