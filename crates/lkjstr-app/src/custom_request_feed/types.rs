use crate::{
    CustomRequestRunPlan, FeedFragmentConfig, FeedViewModel, FeedWindowState, QueryDemandInput,
    RowGeometryModel,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CustomRequestFeedSourceState {
    Idle,
    Planning,
    Canceled,
    RelayProgressive,
    Complete,
    Partial {
        reason: String,
        retry_available: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CustomRequestFeedStatus {
    Idle,
    Planning,
    Ready,
    Partial,
    Canceled,
    Invalid,
    NoRelay,
}

#[derive(Clone, Debug)]
pub struct CustomRequestFeedViewInput {
    pub owner: String,
    pub run_plan: Option<CustomRequestRunPlan>,
    pub source_state: CustomRequestFeedSourceState,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CustomRequestFeedView {
    pub status: CustomRequestFeedStatus,
    pub demand: Option<QueryDemandInput>,
    pub relays: Vec<String>,
    pub window: FeedWindowState,
    pub view_model: FeedViewModel,
}
