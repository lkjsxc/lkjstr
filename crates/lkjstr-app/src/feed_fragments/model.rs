pub const TEXT_SEGMENT_TARGET_CHARS: usize = 1_800;
pub const TEXT_SEGMENT_MAX_CHARS: usize = 2_400;
pub const OVERSIZE_ESTIMATED_HEIGHT: u16 = 1_400;
pub const MEDIA_ITEMS_PER_SEGMENT: u16 = 2;
pub const REFERENCES_PER_SEGMENT: u16 = 1;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedFragmentConfig {
    pub text_segment_target_chars: usize,
    pub text_segment_max_chars: usize,
    pub oversize_estimated_height_px: u16,
    pub media_items_per_segment: u16,
    pub references_per_segment: u16,
}

impl Default for FeedFragmentConfig {
    fn default() -> Self {
        Self {
            text_segment_target_chars: TEXT_SEGMENT_TARGET_CHARS,
            text_segment_max_chars: TEXT_SEGMENT_MAX_CHARS,
            oversize_estimated_height_px: OVERSIZE_ESTIMATED_HEIGHT,
            media_items_per_segment: MEDIA_ITEMS_PER_SEGMENT,
            references_per_segment: REFERENCES_PER_SEGMENT,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SemanticFeedEvent {
    pub event_id: String,
    pub event_kind: u64,
    pub pubkey: String,
    pub created_at: u64,
    pub content: String,
    pub media_count: u16,
    pub reference_count: u16,
    pub relay_provenance: Vec<String>,
    pub has_action_bar: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedVisualRow {
    EventFull(EventFullRow),
    EventHeader(EventMarkerRow),
    EventTextSegment(EventTextSegmentRow),
    EventMediaSegment(EventIndexedRow),
    EventReferenceSegment(EventIndexedRow),
    EventActions(EventMarkerRow),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventFullRow {
    pub event_id: String,
    pub row_key: String,
    pub content: String,
    pub relay_provenance: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventMarkerRow {
    pub event_id: String,
    pub row_key: String,
    pub relay_provenance: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTextSegmentRow {
    pub event_id: String,
    pub row_key: String,
    pub segment_index: u16,
    pub text: String,
    pub starts_at: usize,
    pub ends_at: usize,
    pub relay_provenance: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventIndexedRow {
    pub event_id: String,
    pub row_key: String,
    pub index: u16,
    pub relay_provenance: Vec<String>,
}

impl FeedVisualRow {
    #[must_use]
    pub fn row_key(&self) -> &str {
        match self {
            Self::EventFull(row) => &row.row_key,
            Self::EventHeader(row) | Self::EventActions(row) => &row.row_key,
            Self::EventTextSegment(row) => &row.row_key,
            Self::EventMediaSegment(row) | Self::EventReferenceSegment(row) => &row.row_key,
        }
    }
}
