#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedLodRowKind {
    Event,
    Notification,
    ProfileHeader,
    Footer,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RowCoverageState {
    Loaded,
    Uncovered,
    Incomplete,
    Dense,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLodRow {
    pub row_id: String,
    pub row_kind: FeedLodRowKind,
    pub timestamp_seconds: u64,
    pub estimated_height_px: u32,
    pub measured_height_px: Option<u32>,
    pub coverage: RowCoverageState,
    pub route_group: String,
    pub relay_provenance_count: u16,
    pub has_media: bool,
    pub has_preview: bool,
    pub reply_child_count: u16,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedLodBlock {
    pub start_index: usize,
    pub end_index: usize,
    pub cumulative_height_before_px: u64,
    pub height_px: u64,
    pub min_timestamp_seconds: u64,
    pub max_timestamp_seconds: u64,
    pub loaded_count: usize,
    pub unresolved_count: usize,
}

impl FeedLodRow {
    #[must_use]
    pub fn height_px(&self) -> u32 {
        self.measured_height_px
            .unwrap_or(self.estimated_height_px)
            .max(1)
    }
}
