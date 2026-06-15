use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedDiagnosticSeverity, FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput,
    RowGeometryModel, UserTimelineAuthorSet,
};

use super::UserTimelineDiscoveryPlan;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UserTimelineFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UserTimelineFeedStatus {
    MissingPubkey,
    LoadingDiscovery,
    LoadingFeed,
    NoEnabledRelay,
    Ready,
    TargetPostsOnly,
    Partial,
    Incomplete,
    Failed,
    AuthRequired,
    RateLimited,
    Offline,
}

impl UserTimelineFeedStatus {
    #[must_use]
    pub const fn for_target_mode(target_only: bool) -> Self {
        if target_only {
            Self::TargetPostsOnly
        } else {
            Self::Ready
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserTimelineFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct UserTimelineFeedViewInput {
    pub owner: String,
    pub target_pubkey: Option<String>,
    pub discovery: UserTimelineDiscoveryPlan,
    pub author_set: Option<UserTimelineAuthorSet>,
    pub source_state: UserTimelineFeedSourceState,
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
    pub diagnostics: Vec<UserTimelineFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct UserTimelineFeedView {
    pub status: UserTimelineFeedStatus,
    pub live_query: Option<QueryDemandInput>,
    pub author_set: Option<UserTimelineAuthorSet>,
    pub view_model: FeedViewModel,
}
