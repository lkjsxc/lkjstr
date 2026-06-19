use lkjstr_protocol::FollowEntry;

use crate::follow_graph::TargetFollowListState;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FolloweesStatus {
    MissingPubkey,
    Loading,
    Ready,
    Empty,
    NotFound,
    PartialFailure,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesDiagnostic {
    pub row_id: String,
    pub relay: Option<String>,
    pub message: String,
    pub retry_available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesRow {
    pub row_id: String,
    pub pubkey: String,
    pub relay: Option<String>,
    pub petname: Option<String>,
    pub display_name: Option<String>,
    pub subtitle: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesProfile {
    pub pubkey: String,
    pub display_name: Option<String>,
    pub subtitle: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesView {
    pub owner: String,
    pub target_pubkey: Option<String>,
    pub target_profile: Option<FolloweesProfile>,
    pub status: FolloweesStatus,
    pub message: String,
    pub diagnostics: Vec<FolloweesDiagnostic>,
    pub rows: Vec<FolloweesRow>,
    pub following_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolloweesViewInput {
    pub owner: String,
    pub target_pubkey: Option<String>,
    pub entries: Vec<FollowEntry>,
    pub profiles: Vec<FolloweesProfile>,
    pub state: TargetFollowListState,
}
