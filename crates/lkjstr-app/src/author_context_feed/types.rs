use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuthorContextFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthorContextFeedStatus {
    MissingEvent,
    MissingAuthor,
    NoEnabledRelay,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorContextFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct AuthorContextFeedViewInput {
    pub owner: String,
    pub event_id: Option<String>,
    pub author_pubkey: Option<String>,
    pub source_state: AuthorContextFeedSourceState,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub visibility: DemandVisibility,
    pub anchor_created_at: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub diagnostics: Vec<AuthorContextFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AuthorContextFeedView {
    pub status: AuthorContextFeedStatus,
    pub anchor_query: Option<QueryDemandInput>,
    pub nearby_query: Option<QueryDemandInput>,
    pub view_model: FeedViewModel,
}
