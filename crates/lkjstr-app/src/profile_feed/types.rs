use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};

use crate::{
    FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput, RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProfileFeedSourceState {
    Pending,
    CacheComplete,
    RelayProgressive,
    SearchingOlder {
        since: u64,
        until: u64,
        span_seconds: u64,
    },
    EmptyProven,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProfileFeedStatus {
    MissingPubkey,
    NoEnabledRelay,
    Loading,
    Ready,
    Partial,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProfileFeedDiagnosticInput {
    pub scope: String,
    pub id: String,
    pub severity: crate::FeedDiagnosticSeverity,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct ProfileFeedViewInput {
    pub owner: String,
    pub profile_pubkey: Option<String>,
    pub profile_header: Option<ProfileHeaderView>,
    pub source_state: ProfileFeedSourceState,
    pub selected_relays: Vec<String>,
    pub profile_hint_relays: Vec<String>,
    pub relay_sets_json: String,
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
    pub diagnostics: Vec<ProfileFeedDiagnosticInput>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProfileFeedView {
    pub status: ProfileFeedStatus,
    pub live_query: Option<QueryDemandInput>,
    pub profile_header: Option<ProfileHeaderView>,
    pub view_model: FeedViewModel,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProfileHeaderView {
    pub pubkey: String,
    pub display_name: String,
    pub subtitle: String,
    pub npub: String,
    pub nprofile: Option<String>,
    pub follow_list_json: String,
    pub relay_sets_json: String,
    pub avatar_url: Option<String>,
    pub banner_url: Option<String>,
    pub about: Option<String>,
    pub website: Option<String>,
    pub following_label: String,
    pub following_known: bool,
}
