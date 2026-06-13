use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HomeFollowState {
    Loading,
    Loaded {
        follow_pubkeys: Vec<String>,
    },
    MissingComplete,
    Unavailable {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HomeFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HomeFeedStatus {
    NoActiveAccount,
    LoadingFollows,
    NoEnabledRelay,
    NoFollowList,
    Ready,
    Partial,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HomeFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct HomeFeedViewInput {
    pub owner: String,
    pub active_pubkey: Option<String>,
    pub follow_state: HomeFollowState,
    pub source_state: HomeFeedSourceState,
    pub selected_relays: Vec<String>,
    pub disabled_relays: Vec<String>,
    pub author_routes: Vec<AuthorRelayRoute>,
    pub visibility: DemandVisibility,
    pub since: Option<u64>,
    pub now_sec: u64,
    pub page_size: u64,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub diagnostics: Vec<HomeFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HomeFeedView {
    pub status: HomeFeedStatus,
    pub live_query: Option<QueryDemandInput>,
    pub view_model: FeedViewModel,
}
